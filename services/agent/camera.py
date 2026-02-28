"""
camera.py — Camera abstraction for RTSP IP cam or RPi Camera Module.

Usage:
    cam = Camera()
    jpeg_bytes = cam.capture_jpeg()
    cam.release()
"""

import os
import cv2


class Camera:
    """
    Unified camera interface.

    Priority:
      1. CAMERA_RTSP env var set  → RTSP stream (any IP cam)
      2. Otherwise               → local device (RPi cam or USB webcam, index 0)

    For RPi Camera Module v2/v3, either:
      - Use RTSP via libcamera-vid + mediamtx, or
      - Replace cv2.VideoCapture with picamera2 (see comments below)
    """

    WIDTH  = 640
    HEIGHT = 480
    QUALITY = 60  # JPEG quality 0-100

    def __init__(self):
        rtsp = os.getenv("CAMERA_RTSP", "").strip()
        source = rtsp if rtsp else 0
        self._cap = cv2.VideoCapture(source)

        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open camera source: {source!r}")

        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  self.WIDTH)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.HEIGHT)

    def capture_jpeg(self) -> bytes:
        """Return a JPEG-encoded frame as bytes. Raises RuntimeError on failure."""
        ret, frame = self._cap.read()
        if not ret or frame is None:
            raise RuntimeError("Frame read failed")
        _, buf = cv2.imencode(
            ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, self.QUALITY]
        )
        return buf.tobytes()

    def release(self) -> None:
        self._cap.release()


# ── RPi Camera Module (picamera2) alternative ──────────────────────────────
# Uncomment and replace the Camera class above if you're using the RPi cam
# directly (not via RTSP):
#
# from picamera2 import Picamera2
#
# class Camera:
#     WIDTH = 640; HEIGHT = 480; QUALITY = 60
#
#     def __init__(self):
#         self._cam = Picamera2()
#         self._cam.configure(self._cam.create_video_configuration(
#             main={"size": (self.WIDTH, self.HEIGHT), "format": "RGB888"}
#         ))
#         self._cam.start()
#
#     def capture_jpeg(self) -> bytes:
#         frame = self._cam.capture_array()
#         _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, self.QUALITY])
#         return buf.tobytes()
#
#     def release(self):
#         self._cam.stop()
