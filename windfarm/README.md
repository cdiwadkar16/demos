##INTRO

This is the windfarms demo. 
It uses a nodejs script to simulate data every 5s.
This data is written to a public MQTT broker.

-getweather.py - This is a Python script that uses the openmeteo API to get ambient temperature and wind speed at Altamont Pass
-wfportfolio.js - This is a nodeJS script that uses Mock.js to simulate data and writes to the MQTT broker every 5s.


