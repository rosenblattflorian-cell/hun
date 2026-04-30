"""Photo-Aufmaß Computer-Vision Engine.

Mathematische Grundlage (analog zum bereitgestellten Dachplan-PDF):
1. User markiert 4 Eckpunkte eines Dach-Polygons im Foto (Pixel-Koordinaten)
2. User gibt EIN Referenzmaß zwischen zwei dieser Punkte an (z.B. Trauflänge in Metern)
3. Homographie-Matrix transformiert das schiefe Foto in eine Orthographische Draufsicht
4. Pixel-Distanzen werden mit dem Referenz-Skalierungsfaktor in Meter umgerechnet
5. Sperrflächen (Schornsteine etc.) werden in derselben Pixel-Welt markiert und mittransformiert
"""
from __future__ import annotations
import base64
import io
import math
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import cv2


# -------- Helpers --------

def decode_image(image_b64: str) -> np.ndarray:
    """data:image/jpeg;base64,... oder reines Base64 → BGR ndarray."""
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    data = base64.b64decode(image_b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Bild konnte nicht dekodiert werden")
    return img


def encode_image_jpeg(img: np.ndarray, quality: int = 75) -> str:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok: raise ValueError("Encode fehlgeschlagen")
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


def order_quad(pts: np.ndarray) -> np.ndarray:
    """4 Punkte in TL, TR, BR, BL Reihenfolge sortieren."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # TL
    rect[2] = pts[np.argmax(s)]   # BR
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # TR
    rect[3] = pts[np.argmax(diff)]  # BL
    return rect


# ===================== AUTO-SNAP (Easy-Mode) =====================
# Findet automatisch das größte rechteckige Polygon (Dachfläche) im Bild.

def auto_detect_roof_corners(image_b64: str) -> Dict[str, Any]:
    """
    KI-Auto-Snap: Erkennt automatisch die 4 Eckpunkte einer Dachfläche.

    Pipeline:
      1. Decode + Resize (max 1200px)
      2. Grayscale + GaussianBlur + Canny Edge Detection
      3. Dilatation für Lücken in Kanten
      4. findContours + größtes Polygon mit ≥4 Ecken
      5. approxPolyDP zum 4-Eck-Approximations
      6. Fallback: Heuristik (zentrale Box, größte konvexe Hülle)

    Returns:
      {
        "corners": [{x:0..1, y:0..1}, ...],   # 4 Eckpunkte (TL, TR, BR, BL) als 0..1 normalisiert
        "confidence": 0..1,                   # 0=Heuristik-Fallback, 1=klare Kanten
        "image_w_px": int, "image_h_px": int,
        "method": "contour" | "heuristic",
      }
    """
    img = decode_image(image_b64)
    h, w = img.shape[:2]

    # Resize falls zu groß
    max_side = 1200
    scale = 1.0
    if max(h, w) > max_side:
        scale = max_side / max(h, w)
        img_small = cv2.resize(img, None, fx=scale, fy=scale)
    else:
        img_small = img.copy()
    h_s, w_s = img_small.shape[:2]

    gray = cv2.cvtColor(img_small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive Canny (Otsu Threshold-basiert)
    median = float(np.median(blurred))
    lower = max(20, int(0.66 * median))
    upper = min(255, int(1.33 * median))
    edges = cv2.Canny(blurred, lower, upper, apertureSize=3)

    # Dilatation um Lücken zu schließen
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return _heuristic_corners(w, h)

    # Sortiere nach Fläche, nimm die größten 5
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    best_quad = None
    best_score = 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < (h_s * w_s) * 0.05:  # mindestens 5% des Bildes
            continue
        peri = cv2.arcLength(c, True)
        # Approx zu Polygon
        for eps_factor in (0.02, 0.03, 0.04, 0.05):
            approx = cv2.approxPolyDP(c, eps_factor * peri, True)
            if len(approx) == 4:
                # Score: Konvexität × Flächenanteil
                if cv2.isContourConvex(approx):
                    score = (area / (h_s * w_s))
                    if score > best_score:
                        best_score = score
                        best_quad = approx.reshape(4, 2).astype(np.float32) / scale
                break

    if best_quad is None:
        return _heuristic_corners(w, h)

    ordered = order_quad(best_quad)
    confidence = min(0.5 + best_score, 0.95)
    return {
        "corners": [{"x": float(p[0]) / w, "y": float(p[1]) / h} for p in ordered],
        "confidence": round(confidence, 2),
        "image_w_px": w, "image_h_px": h,
        "method": "contour",
    }


def _heuristic_corners(w: int, h: int) -> Dict[str, Any]:
    """Fallback: setzt eine zentrale Box (60% der Bildfläche)."""
    margin_x = w * 0.20
    margin_y = h * 0.25
    pts = [
        (margin_x, margin_y),                # TL
        (w - margin_x, margin_y),            # TR
        (w - margin_x, h - margin_y),        # BR
        (margin_x, h - margin_y),            # BL
    ]
    return {
        "corners": [{"x": p[0] / w, "y": p[1] / h} for p in pts],
        "confidence": 0.3,
        "image_w_px": w, "image_h_px": h,
        "method": "heuristic",
    }


# ================== /AUTO-SNAP ==================

    pts = np.asarray(pts, dtype=np.float32).reshape(-1, 2)
    if len(pts) != 4:
        raise ValueError("Genau 4 Punkte erforderlich")
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).flatten()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def euclidean(a, b) -> float:
    return float(math.hypot(b[0] - a[0], b[1] - a[1]))


# -------- Refine: Snap to nearest edge --------

def snap_point_to_edge(img: np.ndarray, x: float, y: float, radius: int = 25) -> Tuple[float, float]:
    """Versucht, einen vom User markierten Punkt auf die nächste starke Kante zu snappen.
    Reduziert Genauigkeitsverlust durch unscharfe Touch-Eingabe."""
    h, w = img.shape[:2]
    x0, y0 = int(x), int(y)
    x1, y1 = max(0, x0 - radius), max(0, y0 - radius)
    x2, y2 = min(w, x0 + radius), min(h, y0 + radius)
    if x2 <= x1 + 4 or y2 <= y1 + 4:
        return float(x), float(y)
    patch = img[y1:y2, x1:x2]
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    ys, xs = np.where(edges > 0)
    if len(xs) == 0:
        return float(x), float(y)
    # nearest edge pixel zum Originalpunkt
    cx, cy = (x0 - x1), (y0 - y1)
    d2 = (xs - cx) ** 2 + (ys - cy) ** 2
    i = int(np.argmin(d2))
    return float(x1 + xs[i]), float(y1 + ys[i])


# -------- Core measurement --------

def measure_roof(
    image_b64: str,
    quad_points: List[List[float]],   # [[x,y], [x,y], [x,y], [x,y]] in Pixel
    reference_pair: Tuple[int, int],  # (idx_a, idx_b) der Punkte, zwischen denen das Referenzmaß liegt
    reference_meters: float,
    obstacles: Optional[List[List[List[float]]]] = None,  # Liste von Polygonen in Pixel
    snap: bool = True,
) -> Dict[str, Any]:
    """Hauptberechnung."""
    if reference_meters <= 0:
        raise ValueError("Referenzmaß muss > 0 sein")
    if len(quad_points) != 4:
        raise ValueError("Genau 4 Eckpunkte erforderlich")
    a_idx, b_idx = reference_pair
    if a_idx == b_idx or not (0 <= a_idx < 4 and 0 <= b_idx < 4):
        raise ValueError("Ungültiges Referenz-Paar")

    img = decode_image(image_b64)
    h_img, w_img = img.shape[:2]

    # 1) Snap-Verfeinerung (optional)
    pts = []
    for p in quad_points:
        if snap:
            sx, sy = snap_point_to_edge(img, p[0], p[1])
            pts.append([sx, sy])
        else:
            pts.append([float(p[0]), float(p[1])])
    pts_np = np.array(pts, dtype=np.float32)

    # 2) Quad in TL/TR/BR/BL ordnen, ABER originale Indizes merken (für Referenz)
    ordered = order_quad(pts_np)
    # Bei Sortierung verlieren wir die a_idx/b_idx-Zuordnung. Daher: Referenz immer
    # auf den Original-Punkten messen.
    pa = pts_np[a_idx]; pb = pts_np[b_idx]
    ref_pixel_dist = euclidean(pa, pb)
    if ref_pixel_dist < 1:
        raise ValueError("Referenzpunkte sind zu nah beieinander")

    # 3) Zielrechteck definieren — wir transformieren in eine echte Draufsicht.
    # Berechne Pixel-Längen der Quad-Kanten
    tl, tr, br, bl = ordered
    width_top = euclidean(tl, tr)
    width_bot = euclidean(bl, br)
    height_left = euclidean(tl, bl)
    height_right = euclidean(tr, br)
    avg_w_px = (width_top + width_bot) / 2
    avg_h_px = (height_left + height_right) / 2

    # Skalierungsfaktor: meters per pixel — basierend auf Referenz
    mpp = reference_meters / ref_pixel_dist

    # Die Referenz-Pixel-Distanz wurde IM SCHRÄGEN BILD gemessen — das ist OK,
    # solange Referenz und zu messende Strecken in derselben Ebene liegen
    # (Dachfläche). Für eine korrekte Orthographie nutzen wir Homographie.

    # 4) Homographie auf rektifiziertes Quad
    # Zielmaße: erste Schätzung in Pixel basierend auf avg
    rect_w = max(avg_w_px, 50)
    rect_h = max(avg_h_px, 50)
    dst = np.array([[0, 0], [rect_w - 1, 0], [rect_w - 1, rect_h - 1], [0, rect_h - 1]], dtype=np.float32)
    H, _ = cv2.findHomography(ordered, dst)
    if H is None:
        raise ValueError("Homographie konnte nicht berechnet werden")

    # 5) Originale Punkte transformieren
    src_h = np.hstack([pts_np, np.ones((4, 1))])
    transformed = (H @ src_h.T).T
    transformed = transformed[:, :2] / transformed[:, 2:3]

    # Skalierungsfaktor im rektifizierten Bild: Referenzmaß / transformierte Pixel-Distanz
    ta = transformed[a_idx]; tb = transformed[b_idx]
    ref_rectified_px = euclidean(ta, tb)
    if ref_rectified_px < 1:
        raise ValueError("Referenz im transformierten Bild zu klein")
    mpp_rect = reference_meters / ref_rectified_px

    # 6) Reale Maße berechnen
    # Im rektifizierten Raum sind die 4 Punkte ein Rechteck (theoretisch)
    width_m = rect_w * mpp_rect
    height_m = rect_h * mpp_rect
    area_m2 = width_m * height_m

    # Original-Quad Diagonalen (Plausibilitätscheck)
    diag1 = euclidean(tl, br) * mpp_rect
    diag2 = euclidean(tr, bl) * mpp_rect

    # 7) Sperrflächen transformieren
    transformed_obstacles = []
    if obstacles:
        for poly in obstacles:
            poly_np = np.array(poly, dtype=np.float32)
            if len(poly_np) < 3:
                continue
            poly_h = np.hstack([poly_np, np.ones((len(poly_np), 1))])
            t = (H @ poly_h.T).T
            t = t[:, :2] / t[:, 2:3]
            poly_area_px = abs(cv2.contourArea(t.astype(np.float32)))
            poly_area_m2 = poly_area_px * (mpp_rect ** 2)
            transformed_obstacles.append({
                "points_rectified_px": t.tolist(),
                "area_m2": round(poly_area_m2, 2),
            })

    total_obstacle_area = sum(o["area_m2"] for o in transformed_obstacles)
    usable_area_m2 = max(area_m2 - total_obstacle_area, 0)

    # 8) Orthofoto generieren (rektifiziertes Bild)
    rectified = cv2.warpPerspective(img, H, (int(rect_w), int(rect_h)))
    ortho_b64 = encode_image_jpeg(rectified, quality=70)

    return {
        "image_size": {"width": w_img, "height": h_img},
        "quad_ordered_px": ordered.tolist(),
        "quad_snapped_px": pts_np.tolist(),
        "reference_pair": [a_idx, b_idx],
        "reference_meters": reference_meters,
        "scale_meters_per_pixel_rectified": round(mpp_rect, 6),
        "scale_meters_per_pixel_original": round(mpp, 6),
        "dimensions": {
            "width_m": round(width_m, 2),
            "height_m": round(height_m, 2),
            "area_m2": round(area_m2, 2),
            "diagonal_1_m": round(diag1, 2),
            "diagonal_2_m": round(diag2, 2),
            # Plausibilität: bei rechteckigem Dach sollten Diagonalen ähnlich sein
            "rectangularity_score": round(1 - abs(diag1 - diag2) / max(diag1, diag2, 0.01), 3),
        },
        "obstacles": transformed_obstacles,
        "obstacle_area_m2": round(total_obstacle_area, 2),
        "usable_area_m2": round(usable_area_m2, 2),
        "rectified_image_base64": ortho_b64,
    }


# -------- Obstacle detection (Heuristik) --------

def detect_obstacles(image_b64: str, min_area_ratio: float = 0.001, max_area_ratio: float = 0.1) -> List[Dict[str, Any]]:
    """Schlägt verdächtige Rechtecke (Schornsteine, Dachfenster) zur Bestätigung vor.
    Heuristik: Adaptive Threshold + Konturen + Rechteckigkeits-Score.
    Kein ML-Modell — robust genug als Vorschlag, der vom User bestätigt wird.
    """
    img = decode_image(image_b64)
    h, w = img.shape[:2]
    img_area = h * w

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Adaptive für gleichmäßige Empfindlichkeit
    thr = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY_INV, 31, 5)
    # Rauschen entfernen
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    cleaned = cv2.morphologyEx(thr, cv2.MORPH_OPEN, kernel, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    results = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area_ratio * img_area or area > max_area_ratio * img_area:
            continue
        # Rechteckigkeit prüfen
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.04 * peri, True)
        x, y, bw, bh = cv2.boundingRect(c)
        rect_area = bw * bh
        extent = area / rect_area if rect_area > 0 else 0
        aspect = max(bw, bh) / max(min(bw, bh), 1)
        # Brauchbar: ziemlich rechteckig, nicht zu länglich
        if extent < 0.6 or aspect > 4:
            continue
        kind = "schornstein" if 0.7 < bh / max(bw, 1) < 1.6 and area < 0.02 * img_area else "dachfenster"
        results.append({
            "kind": kind,
            "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
            "polygon": [[int(x), int(y)], [int(x + bw), int(y)],
                        [int(x + bw), int(y + bh)], [int(x), int(y + bh)]],
            "confidence": round(extent, 2),
            "area_px": int(area),
        })
    # Sortiere nach Confidence
    results.sort(key=lambda r: -r["confidence"])
    return results[:10]
