from __future__ import annotations

from resonant_model.cli import main

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # CLI boundary intentionally sanitizes tracebacks.
        print(str(error))
        raise SystemExit(1) from None
