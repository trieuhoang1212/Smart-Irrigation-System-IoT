# pyright: reportMissingImports=false

import socket
import subprocess
from pathlib import Path

from SCons.Script import Import

Import("env")

MOSQUITTO_EXE = Path(r"C:\Program Files\Mosquitto\mosquitto.exe")
MOSQUITTO_CONFIG = Path(r"C:\Program Files\Mosquitto\mosquitto.conf")
MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883


def mqtt_is_running():
    try:
        with socket.create_connection((MQTT_HOST, MQTT_PORT), timeout=1):
            return True
    except OSError:
        return False


if mqtt_is_running():
    print("Mosquitto is already running on port 1883.")
elif not MOSQUITTO_EXE.is_file():
    print(f"Warning: Mosquitto executable not found: {MOSQUITTO_EXE}")
elif not MOSQUITTO_CONFIG.is_file():
    print(f"Warning: Mosquitto config not found: {MOSQUITTO_CONFIG}")
else:
    subprocess.Popen(
        [str(MOSQUITTO_EXE), "-c", str(MOSQUITTO_CONFIG), "-v"],
        cwd=str(MOSQUITTO_CONFIG.parent),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    print("Started Mosquitto on port 1883.")
