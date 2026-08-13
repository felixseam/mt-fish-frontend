import requests
import time

URL = "http://localhost:8080/api/v1/bets"

payload = {
    "session_id": 1,
    "fish_type_id": 1,
    "cannon_type_id": 1,
    "elapsed_seconds": "10.5"
}

for i in range(100):
    start = time.perf_counter()

    try:
        response = requests.post(
            URL,
            json=payload,
            timeout=10
        )

        elapsed = (time.perf_counter() - start) * 1000

        print(
            f"#{i + 1} "
            f"status={response.status_code} "
            f"time={elapsed:.0f}ms"
        )

    except Exception as e:
        print(f"#{i + 1} ERROR: {e}")

    time.sleep(0.1)