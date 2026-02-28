"""
scan_hub.py — Scan for LEGO BOOST Move Hub via BLE.
Run: python scan_hub.py
"""
import asyncio
from bleak import BleakScanner

LEGO_UUID = "00001623-1212-efde-1623-785feabcd123"

async def main():
    print("Scanning for BLE devices (10s)... make sure hub LED is pulsing.")
    devices = await BleakScanner.discover(timeout=10.0, return_adv=True)
    found = []
    print(f"\nFound {len(devices)} devices:")
    for addr, (dev, adv) in devices.items():
        name = dev.name or "(no name)"
        uuids = [str(u).lower() for u in (adv.service_uuids or [])]
        is_hub = LEGO_UUID in uuids or "lego" in name.lower() or "move hub" in name.lower()
        marker = " *** LEGO BOOST ***" if is_hub else ""
        print(f"  {addr}  {name!r:30s}  RSSI={adv.rssi}{marker}")
        if is_hub:
            found.append((addr, name))

    if found:
        print(f"\n✓ Hub found: {found[0][0]}  ({found[0][1]})")
        print(f"\nSet in .env:\n  HUB_MAC={found[0][0]}")
    else:
        print("\n✗ No LEGO Move Hub found.")
        print("  → Hold the green button on the hub until the LED pulses, then retry.")

asyncio.run(main())
