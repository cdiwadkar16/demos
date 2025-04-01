There are 3 containers:
1. FlashMQ

This one is set up to only run on port 1883 and accepts anonymous connections.
There is no log file so logging is on stdout

2. Solar Simulator

This one writes to the FlashMQ container every 30s

3. Wind Turbine Simulator

This one writes to the FlashMQ container every 30s

Assuming you have Docker Desktop installed:

To start the containers
-----------------------
You must be in the directory where the docker-compose.yaml file is:


docker compose up --build

To stop the containers:
----------------------
docker compose down

