# Raspberry Pi SSE servo actuator

This service subscribes to the collector's local SSE endpoint and moves two MG90S servos when a normalized event has a configured `bot_family`.

The default GPIOs are BCM GPIO18 and GPIO19. Change `SERVO1_GPIO` and `SERVO2_GPIO` in the systemd unit if the wiring uses different GPIOs.

Install the runtime dependency:

```bash
sudo apt update
sudo apt install -y python3-gpiozero
```

Install and enable the service:

```bash
sudo cp raspberrypi/servo-sse/insectary-servo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now insectary-servo.service
sudo systemctl status insectary-servo.service --no-pager
```

Follow logs:

```bash
sudo journalctl -u insectary-servo.service -f
```

The MG90S must use a separate stable 5 V supply. Connect the supply ground to Raspberry Pi ground; connect only the servo signal wire to the GPIO. Do not power the servo from a GPIO pin.
