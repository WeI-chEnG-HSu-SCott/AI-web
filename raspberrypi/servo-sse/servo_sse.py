#!/usr/bin/env python3
"""Trigger Raspberry Pi servos when a crawler event arrives over SSE."""

import json
import logging
import os
import time
import urllib.request

from gpiozero import Servo


SSE_URL = os.environ.get("SSE_URL", "http://127.0.0.1:8790/events")
SERVO1_GPIO = int(os.environ.get("SERVO1_GPIO", "18"))
SERVO2_GPIO = int(os.environ.get("SERVO2_GPIO", "19"))
REST_ANGLE = float(os.environ.get("REST_ANGLE", "0"))
TRIGGER_ANGLE = float(os.environ.get("TRIGGER_ANGLE", "1"))
HOLD_SECONDS = float(os.environ.get("HOLD_SECONDS", "0.4"))
RECONNECT_SECONDS = float(os.environ.get("RECONNECT_SECONDS", "5"))
TRIGGERED_BOTS = {
    item.strip().lower()
    for item in os.environ.get(
        "TRIGGERED_BOTS", "oai-searchbot,gptbot,googlebot,bingbot"
    ).split(",")
    if item.strip()
}


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("insectary-servo")


def trigger(servos, active_value):
    for servo in servos:
        servo.value = active_value
    time.sleep(HOLD_SECONDS)


def is_trigger_event(event):
    bot_family = str(event.get("bot_family", "")).strip().lower()
    return bot_family in TRIGGERED_BOTS


def sse_events(response):
    event_data = []
    for raw_line in response:
        line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
        if line == "":
            if event_data:
                payload = "".join(event_data)
                event_data.clear()
                yield json.loads(payload)
            continue
        if line.startswith("data:"):
            event_data.append(line[5:].lstrip())


def run():
    servos = [Servo(SERVO1_GPIO), Servo(SERVO2_GPIO)]
    current_value = REST_ANGLE
    for servo in servos:
        servo.value = current_value

    logger.info(
        "listening to %s; GPIO=%s,%s; bots=%s",
        SSE_URL,
        SERVO1_GPIO,
        SERVO2_GPIO,
        ",".join(sorted(TRIGGERED_BOTS)),
    )

    while True:
        try:
            request = urllib.request.Request(
                SSE_URL,
                headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
            )
            with urllib.request.urlopen(request, timeout=None) as response:
                logger.info("connected to collector")
                for event in sse_events(response):
                    if not isinstance(event, dict):
                        continue
                    logger.info(
                        "event=%s bot=%s path=%s",
                        event.get("event_id", ""),
                        event.get("bot_family", "unknown"),
                        event.get("path", ""),
                    )
                    if is_trigger_event(event):
                        current_value = (
                            TRIGGER_ANGLE
                            if current_value == REST_ANGLE
                            else REST_ANGLE
                        )
                        trigger(servos, current_value)
        except KeyboardInterrupt:
            raise
        except Exception as error:
            logger.warning("SSE connection failed: %s; retrying", error)
            time.sleep(RECONNECT_SECONDS)


if __name__ == "__main__":
    run()
