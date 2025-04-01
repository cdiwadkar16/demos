const taos = require("@tdengine/websocket")
const { Buffer } = require('buffer');

const TDENGINE_CLOUD_URL="wss://xxxxx.cloud.tdengine.com"
const TDENGINE_CLOUD_TOKEN="3c7bdfeca818be38ef659afbxxxxxxxxxxxxxxxxxxxx"

let dsn = 'ws://localhost:6041';

// Constants and initial calculations
const fs = 20000;
const Np = 13;
const Ng = 35;
const fPin = 22.5;
const fGear = fPin * Np / Ng;
const fMesh = fPin * Np;
const ipf = fGear;
const fImpact = 2000;

async function createConnect() {
    try {
        if (process.argv[2] && process.argv[2] === 'local') {
            var conf = new taos.WSConfig(dsn);
            conf.setUser('root');
            conf.setPwd('!Tdengine1');
            conf.setDb('vibrationdata');
        }
        else if (process.argv[2] && process.argv[2] === 'cloud') {
            var conf = new taos.WSConfig(TDENGINE_CLOUD_URL);
            conf.setToken(TDENGINE_CLOUD_TOKEN);
        }
        
        conn = await taos.sqlConnect(conf);
        console.log("Connected successfully.");
        return conn;
    } catch (err) {
        console.log("Failed to connect ErrCode: " + err.code + ", ErrMessage: " + err.message);
        throw err;
    }

}

function checkError(result) {
    if (result.getErrCode() !== undefined) {
      console.log(result.getErrCode(), result.getErrStr());
      process.exit(1);
    }
  }

function getCurrentTimestamp() {
    const now = new Date();
  
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
  
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

async function insertData(stmt,conn) {
    //console.log("In insertData");
    try {
        //wsSql = await createConnect();
        taosResult = await conn.exec(stmt);
        console.log("Successfully inserted " + taosResult.getAffectRows());
    } catch (err) {
        console.error(`Failed to insert data to sql: ErrCode: ${err.code}, ErrMessage: ${err.message}`);
        throw err;
    } 
}

class System {
    constructor(operationalPlants) {
        this.plants = [];
        for (let i = 0; i < operationalPlants.length; i++) {
            this.plants.push(new Plant(operationalPlants[i]));
        }
    }

    async start() {
        //this.plants.forEach(plant => await plant.start());
        for (let i=0; i < this.plants.length; i++) {
            try {
                await this.plants[i].start();
            }
            catch (err) {
                console.error(`Failed to start plant: ${i}`)
            }
        }
    }
}

class Plant {
    constructor(plantId) {
        this.plantId = plantId;
        this.machines = [];
        this.tdengineConnection = null;

//        for (let i = 0; i < 50; i++) {
        for (let i = 0; i < 2; i++) {
            this.machines.push(new Machine(this.plantId, i + 1)); 
        }
    }

    async closeConnection () {
        try {
            await this.tdengineConnection.close();
        } catch (err) {
            console.error(`Connection error: ErrCode: ${err.code}, ErrMessage: ${err.message}`);
            throw err;
        }
    }

    async start() {
        try {
            this.tdengineConnection = await createConnect();
            console.log(`Connection setup for Plant ${this.plantId}`)
            this.machines.forEach(machine => machine.start(this.tdengineConnection));
        }
        catch (err){
            console.error(`Connection error: ErrCode: ${err.code}, ErrMessage: ${err.message}`);
            throw err;
        }
    }
}

class Machine {
    constructor(plantId, machineId) {
        this.plantId = plantId;  // Reference to the plant this machine belongs to
        this.id = machineId;
        this.conn = null;
    }
    start(conn) {
        if (conn === null) {
            console.log(`Database connection is null in Plant ${this.plantId} machine ${this.id}`)
        }
        else {
            this.conn = conn;
        }
        const currtime = getCurrentTimestamp();
        console.log(`Machine ${this.id} in Plant ${this.plantId} started at ${currtime}`);
        this.timer = setInterval(() => {
            this.runMachine();
        }, 30000); // Update every 10 minutes in real-time
    }
    async runMachine () {
       const t = generateTimeArray(1); // Generate 1 second of data
       const ts = generateTimeStampArray(1); //Generate array of timestamps in microseconds
       //console.log(t);
       //console.log(ts);
       const signals = generateSignals(t);
       //plotSignals(t, signals);
       if (this.plantId === "rahway" && this.id === 1) {
            await this.writeSignals(t, ts, signals.pinFaultNoisy);
       }
       else {
            //await this.writeSignals(t, ts, signals.healthyNoisy);
            await this.writeSignals(t, ts, signals.healthy);
       }
       //console.log(`Writing 1 second of signal data for ${this.plantId} - ${this.id}`);
    }

    async writeSignals(t, ts, signals) {
        const subtable = this.plantId+"_"+this.id;
        const promises = [];
        //var stmt = `insert into vibrations.\`${subtable}\` using vibrations.\`machines\` `; 
        let startstr = `insert into vibrationdata.\`${subtable}\` using vibrationdata.\`machines\` `; 
        startstr += `tags ('${this.plantId}','${this.id}') values `;
        let stmt = startstr;
        //for (let i=0; i < signals.pinFaultNoisy.length; i++) {
        for (let i=0; i < signals.length; i++) {
            //console.log(`** In writeSignals got ${t[i]} and ${ts[i]}`)
            //stmt += `('${ts[i]}',${signals.pinFaultNoisy[i]})`;
            //const addstr = `('${ts[i]}',${signals.pinFaultNoisy[i]})`;
            const addstr = `('${ts[i]}',${signals[i]})`;
            if (Buffer.byteLength(addstr,'utf8') + Buffer.byteLength(stmt,'utf8') < 1048576) {
                stmt += addstr;
            }
            else {
                console.log(stmt);
                promises.push(insertData(stmt,this.conn).catch(err => {
                    console.error(`Error inserting initial data: ${err.messsage}`);
                }));
                stmt = startstr;
                stmt += addstr;
            }
        }
        if (stmt !== startstr) {
                promises.push(insertData(stmt,this.conn).catch(err => {
                    console.error(`Error inserting remaining data: ${err.messsage}`);
                }));
        }
        try {
            await Promise.all(promises);
            //console.log('All data inserted');
        }
        catch (err) {
            console.error('Error with batch insert:',err.message);
        }
        //await insertData(stmt,this.conn);
        //console.log(stmt);
    }

}

function generateTimeStampArray (duration) {
    const startTime = Date.now() * 1000; // Current time in microseconds
    return Array.from({ length: Math.floor(duration * fs) }, (_, i) => startTime + i * (1_000_000 / fs));

}
// Function to generate time array
function generateTimeArray(duration) {
    return Array.from({length: Math.floor(duration * fs)}, (_, i) => i / fs);
}

// Function to generate signals
function generateSignals(t) {
    const afIn = t.map(time => 0.4 * Math.sin(2 * Math.PI * fPin * time));
    const afOut = t.map(time => 0.2 * Math.sin(2 * Math.PI * fGear * time));
    const aMesh = t.map(time => Math.sin(2 * Math.PI * fMesh * time));
    const aHealthy = afIn.map((val, index) => val + afOut[index] + aMesh[index]);
    
    const tImpact = Array.from({length: Math.floor(2.5e-4 * fs)}, (_, i) => i / fs);
    const xImpact = tImpact.map(time => Math.sin(2 * Math.PI * fImpact * time) / 3);
    
    const xImpactPer = t.map(time => {
        const pulseTrain = Math.floor(time * ipf) % 2 === 0 ? xImpact : [];
        return pulseTrain.reduce((acc, val) => acc + val, 0);
    });
    
    const aFaulty = aHealthy.map((val, index) => val + xImpactPer[index]);
    const aHealthyNoisy = aHealthy.map(val => val + (Math.random() - 0.5) / 5);
    const aFaultyNoisy = aFaulty.map(val => val + (Math.random() - 0.5) / 5);
    
    const SideBands = Array.from({length: 7}, (_, i) => i - 3);
    const SideBandAmp = [0.02, 0.1, 0.4, 0, 0.4, 0.1, 0.02];
    const SideBandFreq = SideBandAmp.map((amp, index) => fMesh + SideBands[index] * fPin);
    
    const vSideBands = SideBandFreq.map(freq => t.map(time => SideBandAmp[SideBandFreq.indexOf(freq)] * Math.sin(2 * Math.PI * freq * time)));
    
    const vPinFaultNoisy = aFaultyNoisy.map((val, index) => val + vSideBands.reduce((acc, band) => acc + band[index], 0));
    
    return {
        healthy: aHealthy,
        faulty: aFaulty,
        healthyNoisy: aHealthyNoisy,
        faultyNoisy: aFaultyNoisy,
        pinFaultNoisy: vPinFaultNoisy
    };
}

// Function to plot signals
function plotSignals(t, signals) {
    const traces = [
        {
            x: t,
            y: signals.healthy,
            type: 'scatter',
            mode: 'lines',
            name: 'Healthy'
        },
        {
            x: t,
            y: signals.faulty,
            type: 'scatter',
            mode: 'lines',
            name: 'Faulty'
        },
        {
            x: t,
            y: signals.healthyNoisy,
            type: 'scatter',
            mode: 'lines',
            name: 'Healthy Noisy'
        },
        {
            x: t,
            y: signals.faultyNoisy,
            type: 'scatter',
            mode: 'lines',
            name: 'Faulty Noisy'
        },
        {
            x: t,
            y: signals.pinFaultNoisy,
            type: 'scatter',
            mode: 'lines',
            name: 'Pin Fault Noisy'
        }
    ];

    const layout = {
        title: 'Gear Signals',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Acceleration (m/s^2)' }
    };

    Plotly.newPlot('plotDiv', traces, layout);
}

// Function to handle the output period
function startOutputPeriod() {
    // Create a div for the plot if it doesn't exist
    if (!document.getElementById('plotDiv')) {
        const plotDiv = document.createElement('div');
        plotDiv.id = 'plotDiv';
        document.body.appendChild(plotDiv);
    }

    let outputInterval = setInterval(function() {
        const t = generateTimeArray(1); // Generate 1 second of data
        const ts = generateTimeStampArray(1); //Generate array of timestamps in microseconds
        //console.log(t.slice(0,20));
        //console.log(ts.slice(0,20));
        const signals = generateSignals(t);
        plotSignals(t, signals);
        //console.log("Plotting 1 second of signal data...");
    }, 60000); // Update every 10 minutes
}


// Initialize the system of 5 plants
//operationalPlants = ["Fremont","Rahway","RTP","Springfield","Kalamazoo"]
operationalPlants = ["fremont","rahway"]
const system = new System(operationalPlants);
(async () => {
    
    try {
        await system.start();
    }
    catch (err) {
        console.error(`Problem starting system ${err.message}`);
    }
})();
