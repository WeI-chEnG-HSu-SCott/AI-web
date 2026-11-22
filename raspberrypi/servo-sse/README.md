# Raspberry Pi SSE servo actuator

`servo_sse.py` is the Raspberry Pi equivalent of the original ESP32 program:

1. Connects to `http://127.0.0.1:8790/events`.
2. Reads each SSE `data:` JSON event.
3. Prints timestamp, IP, method, path, status, and user agent.
4. Toggles both MG90S servos between two positions on every event.
5. Reconnects automatically if the collector connection closes.

The default pins use BCM GPIO18 and GPIO19. `gpiozero.Servo` uses values from `-1` to `1`; adjust `REST_POSITION` and `ACTIVE_POSITION` in the systemd unit if the servo direction or limits need calibration.

Install:

```bash
sudo apt update
sudo apt install -y python3-gpiozero
sudo cp raspberrypi/servo-sse/insectary-servo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now insectary-servo.service
```

After changing `servo_sse.py`:

```bash
sudo systemctl restart insectary-servo.service
```

After changing the `.service` file:

```bash
sudo systemctl daemon-reload
sudo systemctl restart insectary-servo.service
```

View logs:

```bash
sudo journalctl -u insectary-servo.service -f
```

Power the MG90S servos from a separate stable 5 V supply. Connect the external supply ground to Raspberry Pi ground and connect only the servo signal wire to each GPIO. Never power a servo from a Raspberry Pi GPIO pin.
