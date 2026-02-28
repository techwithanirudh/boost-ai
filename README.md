# Boost + Xiaomi Camera Setup (Raspberry Pi)

This repo currently vendors `videoP2Proxy` and runs it on a 64-bit Pi by cross-building a 32-bit binary (required by bundled Xiaomi/TUTK libs).

## Prerequisites (global packages)

```bash
sudo dpkg --add-architecture armhf
sudo apt-get update

sudo apt-get install -y \
  build-essential git python3 python3-dev python3-miio \
  autoconf automake libtool pkg-config libjson-c-dev libjson-c-dev:armhf \
  gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf \
  libc6:armhf libstdc++6:armhf
```

Notes:
- `liblivemedia-dev` is not available on this distro repo, so this setup builds without RTSP mode.
- Xiaomi CLI is available as `python3 -m miio.cli`.

## Build `videoP2Proxy`

```bash
cd videoP2Proxy
make distclean >/dev/null 2>&1 || true

PKG_CONFIG_LIBDIR=/usr/lib/arm-linux-gnueabihf/pkgconfig:/usr/share/pkgconfig \
CC=arm-linux-gnueabihf-gcc \
CXX=arm-linux-gnueabihf-g++ \
./configure \
  --host=arm-linux-gnueabihf \
  --with-p2plibpath=./lib/Linux/Arm_BCM2836_4.8.3 \
  --disable-live555

make -j"$(nproc)"
sudo make install
```

## Run proxy

```bash
videop2proxy --ip CAMERA_IP --token CAMERA_HEX_TOKEN --stdout
```

## Xiaomi token extraction (recommended)

`python-miio` cloud login is often blocked by Xiaomi captcha/verification challenges.
Use `Xiaomi-cloud-tokens-extractor` instead.

### Option A: one-liner (run.sh)

```bash
bash <(curl -L https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor/raw/master/run.sh)
```

### Option B: manual (same result)

```bash
cd /home/node/boost
git clone https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor.git
cd Xiaomi-cloud-tokens-extractor
python3 -m pip install --break-system-packages -r requirements.txt
python3 token_extractor.py
```

During login:
- choose `q` for QR login
- choose server `i2` for India
- copy token for your camera model (for example `chuangmi.camera.ipc019`)

Then run proxy using that token:

```bash
videop2proxy --ip CAMERA_IP --token CAMERA_HEX_TOKEN --stdout
```

## Xiaomi cloud CLI (legacy / may fail)

List commands:

```bash
python3 -m miio.cli cloud --help
```

Login + list devices:

```bash
python3 -m miio.cli cloud --username YOUR_EMAIL --password YOUR_PASSWORD list
```
