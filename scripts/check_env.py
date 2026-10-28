import sys

pkgs = ['torch', 'torchvision', 'ultralytics', 'cv2', 'timm', 'transformers', 'PIL', 'scipy', 'numpy', 'fastapi', 'uvicorn', 'sqlalchemy']

print("=== Python Environment Inspection ===")
print("Python:", sys.version)

for p in pkgs:
    try:
        mod = __import__(p)
        print(f"[OK] {p}: {getattr(mod, '__version__', 'installed')}")
    except ImportError as e:
        print(f"[MISSING] {p}: NOT INSTALLED ({e})")
