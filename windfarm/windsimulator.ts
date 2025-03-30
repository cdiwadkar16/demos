import * as mqtt from 'mqtt';
import * as Mock from 'mockjs';
import moment from 'moment';
import { fetchWeatherApi } from 'openmeteo';


let mqttserver = '';
let mqtthost = '';

const url = 'https://api.open-meteo.com/v1/forecast';

if (process.argv[2] && process.argv[2] === 'emqx') {
    mqttserver = 'mqtt://broker.emqx.io:1883';
}
else if (process.argv[2] && process.argv[2] === 'hivemq') {
    mqttserver = 'mqtt://broker.hivemq.com:1883';
} 
else if (process.argv[2] && process.argv[2] === 'local') {
    mqtthost = process.env.MQTT_HOST || 'localhost';
    mqttserver = `mqtt://${mqtthost}:1883`;
}

// Type definitions
interface MockData {

    ambienttemperature_c: number; 
    windspeed_mps: number;
    rotorspeed_rpm: number; 
    generatorspeed_rpm: number;
    gearboxtemp_c: number;
    bearingtemp_c: number;
    poweroutput_kw: number; 
    bladepitch_angle0: number;
    bladepitch_angle1: number;
    bladepitch_angle2: number;
    tstamp: string;
}

interface Turbinedata extends MockData {
    turbineid: string;
    farm: string;
}

const CLIENT_NUM: number = 20;
const AWAIT: number = 30000; // Sleep time after data is written once

// Global variables
const CLIENT_POOL: mqtt.MqttClient[] = [];

startMock();

/**
 * Sleep function to introduce delays
 * @param timer - Delay in milliseconds
 */
function sleep(timer: number = 100): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timer);
  });
}

/**
 * Start the mock data generation and MQTT publishing process
 * @param at - Ambient temperature
 * @param ws - Wind speed
 */
async function startMock(): Promise<void> {
  const now: number = Date.now();
  const sites: string[] = ['windfarma', 'windfarmb', 'windfarmc'];

  // Create MQTT clients for each turbine
  for (const site of sites) {
    for (let i = 0; i < CLIENT_NUM; i++) {
      const client = await createClient(`${site}-turbine-${i}`);
      CLIENT_POOL.push(client);
    }
  }

  // Continuously generate and publish mock data
  while (true) {
    const ts = Date.now();
    const mins = new Date(ts).getMinutes();
    
    let at: string = '12';
    let ws: string = '7';
    for (const client of CLIENT_POOL) {
      const sid: string = client.options.clientId as string;
      const site: string = sid.split('-')[0];
      if (mins % 5 === 0) {
        [at, ws] = await getWeather();
      }
      const mockData = generateMockData(at, ws);

      const data = {
        ...mockData,
        turbineid: sid,
        farm: site,
      };

      client.publish('tdewind', JSON.stringify(data));
    }

    const dateStr: string = new Date(ts).toLocaleTimeString();
    console.log(`${dateStr} send success.`);
    await sleep(AWAIT);
  }

  console.log(`Done, use ${(Date.now() - now) / 1000}s`);
}

/**
 * Create an MQTT client
 * @param clientId - Client ID for the MQTT client
 * @returns A promise that resolves to the MQTT client
 */
function createClient(clientId: string): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(mqttserver, { clientId });

    client.on('connect', () => {
      console.log(`client ${clientId} connected`);
      resolve(client);
    });

    client.on('reconnect', () => {
      console.log('reconnect');
    });

    client.on('error', (e: Error) => {
      console.error(e);
      reject(e);
    });
  });
}

/**
 * Generate mock data for wind turbines
 * @param at - Ambient temperature
 * @param ws - Wind speed
 * @returns Mock data object
 */
function generateMockData(at: string, ws: string): MockData {
    const dateStr: string = moment().format();
    //const windspeedf: number = parseFloat(ws) + parseFloat(Mock.Random.float(0, 2));
    const windspeedf: number = parseFloat(ws) + Mock.Random.float(0, 2);
    const windspeed: number = parseFloat(windspeedf.toFixed(2));
    const atf: number = parseFloat(at);
    const rotorspeedf: number = windspeedf;
    const rotorspeed_rpm: number = parseFloat(rotorspeedf.toFixed(2));
    const generatorspeedf: number = rotorspeedf * 41 + 667;
    const generatorspeed_rpm: number = parseFloat(generatorspeedf.toFixed(2));
    const bearingtemp: number = parseFloat(at) + 25.0 + Mock.Random.float(0, 3);
    const poweroutput: number = 154.6 * windspeed - 100.8;
    const bladepitch_deg0: number = parseFloat(Mock.Random.float(0, 30).toFixed(2));
    const bladepitch_deg1: number = parseFloat(Mock.Random.float(0, 30).toFixed(2));
    const bladepitch_deg2: number = parseFloat(Mock.Random.float(0, 30).toFixed(2));

    return {
        ambienttemperature_c: parseFloat(atf.toFixed(2)),
        windspeed_mps: windspeed,
        rotorspeed_rpm: rotorspeed_rpm,
        generatorspeed_rpm: generatorspeed_rpm,
        gearboxtemp_c: parseFloat(Mock.Random.float(8, 75).toFixed(2)),
        bearingtemp_c: parseFloat(bearingtemp.toFixed(2)),
        poweroutput_kw: parseFloat(poweroutput.toFixed(2)),
        bladepitch_angle0: bladepitch_deg0,
        bladepitch_angle1: bladepitch_deg1,
        bladepitch_angle2: bladepitch_deg2,
        tstamp: dateStr,
    };
}

/**
 * Get weather data (ambient temperature and wind speed)
 * @returns Tuple containing ambient temperature and wind speed
 */

async function getWeather(): Promise<[string, string]> {
    try {
        const params = {
            "latitude": 37.74,
	        "longitude": 121.65,
            "current": ["temperature_2m", "wind_speed_10m"],
            "wind_speed_unit": "ms",
            "timezone": "America/Los_Angeles"
        };
        const responses = await fetchWeatherApi(url, params);

        // Process first location. Add a for-loop for multiple locations or weather models
        const response = responses[0];

        // Current values. The order of variables needs to be the same as requested.
        const current = response.current()!;
        const currentTemperature2m = current.variables(0)!.value();
        const currentWindSpeed10m = current.variables(1)!.value();
    
        const hourly = response.hourly()!;
        const radiation = hourly?.variables(0)?.value ?? 0;
    
        console.log(`${currentTemperature2m} ${currentWindSpeed10m} ${radiation}`);
        return [currentTemperature2m.toString(), currentWindSpeed10m.toString()];
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return ['12', '7']; // Default values in case of error
    }
}