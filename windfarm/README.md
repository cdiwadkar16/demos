##INTRO

This is the windfarms demo. 
It uses a nodejs script to simulate data every 5s.
This data is written to any MQTT broker that is specified on the command line.

-windsimulators.ts - Typescript code that uses the openmeteo API to get ambient temperature and wind speed at Altamont Pass and generates data for several wind turbines. There is some amount of randomization built in but this is not a physics model.


