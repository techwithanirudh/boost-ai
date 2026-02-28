"""
Quick sanity check: connect to hub, print battery, nudge motors.
Run: python test_connect.py
"""
import time
from dotenv import load_dotenv
load_dotenv()
from hub import connect, forward_cm, stop

print("Connecting to hub...")
hub = connect(retries=3)
print("Connected!")

try:
    print("Forward 5 cm...")
    forward_cm(hub, 5)
    print("Stop.")
    stop(hub)
finally:
    hub.disconnect()
    print("Disconnected.")
