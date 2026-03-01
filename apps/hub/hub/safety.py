import time


class Watchdog:
    def __init__(self, timeout_s: float = 5.0):
        self.timeout_s = timeout_s
        self.last_pet = time.monotonic()

    def pet(self) -> None:
        self.last_pet = time.monotonic()

    def expired(self) -> bool:
        return (time.monotonic() - self.last_pet) > self.timeout_s
