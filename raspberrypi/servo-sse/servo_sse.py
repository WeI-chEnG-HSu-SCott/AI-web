#!/usr/bin/env python3
"""Receive collector SSE events and toggle two MG90S servos."""

import json
import logging
import os
import time
import urllib.request
import ipaddress

from gpiozero import Servo

SSE_URL = os.environ.get("SSE_URL", "http://127.0.0.1:8790/events")
SERVO1_GPIO = int(os.environ.get("SERVO1_GPIO", "18"))
SERVO2_GPIO = int(os.environ.get("SERVO2_GPIO", "19"))
REST_POSITION = float(os.environ.get("REST_POSITION", "-1"))
ACTIVE_POSITION = float(os.environ.get("ACTIVE_POSITION", "1"))
RECONNECT_SECONDS = float(os.environ.get("RECONNECT_SECONDS", "5"))
MOVE_DELAY_SECONDS = float(os.environ.get("MOVE_DELAY_SECONDS", "0.4"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("insectary-servo")


def read_sse_events(response):
    data_lines = []

    for raw_line in response:
        line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")

        if line == "":
            if data_lines:
                yield json.loads("".join(data_lines))
                data_lines.clear()
            continue

        if line.startswith("data: "):
            data_lines.append(line[6:])


def print_event(timestamp, ip, method, path, status, agent):
    print("--- requirement ---", flush=True)
    print(f"Time: {timestamp}", flush=True)
    print(f"IP: {ip}", flush=True)
    print(f"Method: {method}", flush=True)
    print(f"Path: {path}", flush=True)
    print(f"Status: {status}", flush=True)
    print(f"Agent: {agent}", flush=True)
    ip_seed = int(ipaddress.ip_address(ip))
    print(f"IP Seed: {ip_seed}", flush=True)

    print("--------------------", flush=True)


def run():
    servo1 = Servo(SERVO1_GPIO)
    servo2 = Servo(SERVO2_GPIO)
    current_position = REST_POSITION

    servo1.value = current_position
    servo2.value = current_position

    logger.info("connecting to %s", SSE_URL)

    while True:
        try:
            request = urllib.request.Request(
                SSE_URL,
                headers={
                    "Accept": "text/event-stream",
                    "Connection": "keep-alive",
                },
            )

            with urllib.request.urlopen(request, timeout=None) as response:
                logger.info("connected to collector")

                for event in read_sse_events(response):
                    if not isinstance(event, dict):
                        continue
                    timestamp = event.get('timestamp', 'N/A')
                    ip = event.get('client_ip', 'N/A')
                    method = event.get('method', 'N/A')
                    path = event.get('path', 'N/A')
                    status = event.get('status', 0)
                    agent = event.get('user_agent', 'N/A')
                    

                    print_event(timestamp, ip, method, path, status, agent)

                    if current_position == REST_POSITION:
                        current_position = ACTIVE_POSITION
                    else:
                        current_position = REST_POSITION

                    servo1.value = current_position
                    servo2.value = current_position
                    time.sleep(MOVE_DELAY_SECONDS)

        except KeyboardInterrupt:
            servo1.detach()
            servo2.detach()
            raise
        except json.JSONDecodeError as error:
            logger.warning("JSON parse failed: %s", error)
        except Exception as error:
            logger.warning("collector connection failed: %s", error)
            time.sleep(RECONNECT_SECONDS)


if __name__ == "__main__":
    run()
