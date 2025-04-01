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
    ambienttemperature_c: string;
    windspeed_mps: number;
    poweroutput_kw: number | string;
    current: number | string;
    voltage: number | string;
    tstamp: string;
}

interface PanelData extends MockData {
    panelid: string;
    string: string;
    site: string;
}


const STRINGS = 10;
const PANELS = 10;
const AWAIT = 30000; // Sleep time after data be written once to avoid data writing too fast
const CLIENT_POOL: mqtt.MqttClient[] = [];

startMock();

function sleep(timer: number = 100): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, timer);
    });
}

async function startMock(): Promise<void> {
    const now = Date.now();
    const sites: string[] = ["solarfarma", "solarfarmb", "solarfarmc"];
    let lat: string, lon: string;
    const gps = new Map<string, string>();
    gps.set("solarfarma", "37.041,-120.92");
    gps.set("solarfarmb", "37.61,-121.90");
    gps.set("solarfarmc", "33.71,-115.45");
    const atws = new Map<string, [string, string]>();

    for (let k = 0; k < sites.length; k++) {
        [lat, lon] = gps.get(sites[k])!.split(",");
        console.log("GPS:" + lat + " " + lon);
        //let [at, ws] = getWeather(lat, lon);
        let [at, ws] = await getWeather(lat, lon);
        console.log("Weather:" + at + " " + ws);
        atws.set(sites[k], [at, ws]);
        for (let l = 0; l < STRINGS; l++) {
            for (let i = 0; i < PANELS; i++) {
                const client = await createClient(`${sites[k]}-string${l}-panel${i}`);
                CLIENT_POOL.push(client);
            }
        }
    }

    while (true) {
        const ts = Date.now();
        const mins = new Date(ts).getMinutes();
        if (mins % 5 === 0) {
            for (let k = 0; k < sites.length; k++) {
                [lat, lon] = gps.get(sites[k])!.split(",");
                let [at, ws] = await getWeather(lat, lon);
                console.log("GPS:" + lat + " " + lon);
                console.log("Weather:" + at + " " + ws);
                atws.set(sites[k], [at, ws]);
            }
        }

        for (const client of CLIENT_POOL) {
            const sid = client.options.clientId;
            let [site, str, panel] = sid!.split("-");
            const mockData = generateMockData(atws.get(site)![0], atws.get(site)![1]);
            const data: PanelData = {
                ...mockData,
                panelid: panel,
                string: str,
                site: site,
            };
            client.publish('tdesolar', JSON.stringify(data));
        }
        const dateStr = new Date(ts).toLocaleTimeString();
        console.log(`${dateStr} send success.`);
        await sleep(AWAIT);
    }
}

function createClient(cid: string): Promise<mqtt.MqttClient> {
    return new Promise((resolve, reject) => {
        const client = mqtt.connect(mqttserver, {
            clientId: cid,
        });
        client.on('connect', () => {
            console.log(`client ${cid} connected`);
            resolve(client);
        });
        client.on('reconnect', () => {
            console.log('reconnect');
        });
        client.on('error', (e) => {
            console.error(e);
            reject(e);
        });
    });
}

function generateMockData(at: string, ws: string): MockData {
    const ts = Date.now();
    const hrs = new Date(ts).getHours();
    
    const dateStr = moment().format();
    const windspeedf = parseFloat(ws) + (Mock.Random.float(0, 2) as number);
    const windspeed = parseFloat(windspeedf.toFixed(2));
    const atf = parseFloat(at);
    const radiation = (Mock.Random.float(790, 820) as number); /* KW/m2 */
    const efficiency = 0.29;
    const area = 1.5;
    const poweroutput = radiation * efficiency * area;
    const deltat = atf - 4.0 - 25.0;
    const tempcoeff = -0.0045;
    const powerouteff = poweroutput * (1 + (tempcoeff * deltat));
    const current = 9.0 * (radiation / 1000);
    const voltage = powerouteff / current;

    // if it's night time everything goes to 0 except ambient temp and windspeed
    if (hrs > 20 || hrs < 6) {
        return {
            "ambienttemperature_c": atf.toFixed(2),
            "windspeed_mps": windspeed,
            "poweroutput_kw": 0.0,
            "current": 0.0,
            "voltage": 0.0,
            "tstamp": dateStr
        };
    } else {
        return {
            "ambienttemperature_c": atf.toFixed(2),
            "windspeed_mps": windspeed,
            "poweroutput_kw": powerouteff.toFixed(2),
            "current": current.toFixed(2),
            "voltage": voltage.toFixed(2),
            "tstamp": dateStr
        };
    }
}

async function getWeather(lat: string, long: string): Promise<[string, string]> {
    try {
        const params = {
            "latitude": lat,
            "longitude": long,
            "current": ["temperature_2m", "wind_speed_10m"],
            "wind_speed_unit": "ms",
            "hourly": "shortwave_radiation_instant",
            timezone: "America/Los_Angeles"
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
        return ['0', '0']; // Default values in case of error
    }
}
