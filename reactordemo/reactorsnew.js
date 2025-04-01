const mqtt = require('mqtt');
const fs = require('fs');
const readline = require('readline-sync');

// Base Pump Class
class Pump {
    constructor(flowRate, temperature, voltage = 220) {
        this.flowRate = flowRate;  // Flow rate in liters/minute
        this.temperature = temperature;  // Temperature in Celsius
        this.voltage = voltage;  // Voltage applied to the pump
        this.rpm = this.calculateRPM(voltage);  // RPM of the pump
        this.targetFlowRate = flowRate;  // The desired constant flow rate
        this.flowCoefficient = 0.1; // Coefficient that relates RPM to flow rate (simplified)
        this.failed = false; // To track if the pump has failed
    }

    // Calculate RPM from voltage (linear relationship assumed for simplicity)
    calculateRPM(voltage) {
        const maxRPM = 3000; // Assume max RPM at 220V
            const baseVoltage = 220; // Nominal voltage
            return (voltage / baseVoltage) * maxRPM;
    }

    // Update the voltage and recalculate the RPM
    updateVoltage(newVoltage) {
        this.voltage = newVoltage;
        this.rpm = this.calculateRPM(newVoltage);
        this.updateFlowRateFromRPM();
    }

    // Calculate flow rate based on RPM
    updateFlowRateFromRPM() {
        this.flowRate = this.rpm * this.flowCoefficient;
    }

    // Adjust the voltage to maintain the target flow rate
    adjustFlowRate() {
        const tolerance = 0.1; // 10% tolerance
        if (Math.abs(this.flowRate - this.targetFlowRate) > tolerance) {
            if (this.flowRate < this.targetFlowRate) {
                this.updateVoltage(this.voltage + 5); // Increase voltage to boost RPM
            } else if (this.flowRate > this.targetFlowRate) {
                this.updateVoltage(this.voltage - 5); // Decrease voltage to reduce RPM
            }
        }
    }

    // Simulate a temperature change 
    changeTemperature() {
        this.temperature += (Math.random() - Math.random()) * 1; // Randomly increase/decrease temp by 0 to 1 degrees
    }

    // Check if the pump has failed due to high temperature
    checkForFailure() {
        if (this.temperature > 100) { // Failure threshold
            this.failed = true;
        }
    }
}

// Inlet Pump Class
class InletPump extends Pump {
    constructor(flowRate, temperature, voltage) {
        super(flowRate, temperature, voltage);
    }
}

// Outlet Pump Class
class OutletPump extends Pump {
    constructor(flowRate, temperature, voltage) {
        super(flowRate, temperature, voltage);
    }
}

class Reactor {
    //constructor(region,plantId, reactorId, mqttClient) {
    constructor(region,plantId, reactorId) {
        this.region = region;
        this.plantId = plantId;  // Reference to the plant this reactor belongs to
        this.id = reactorId;  // Reactor ID
        this.inletPump = new InletPump(5, 25); // Initial flow rate 5 L/min, temperature 25°C, voltage 220V
        this.outletPump = new OutletPump(5, 50); // Initial outlet flow rate and temp, voltage 220V
        this.reactantConcentrations = [1.0, 1.0, 1.0]; // Initial concentrations in mol/L
        this.pressure = 1; // Initial pressure in atm
        this.internalTemperature = 25; // Starting temperature in Celsius
        this.rateConstant = 0.01; 
        this.productionAmount = 0; // Amount of product produced in liters
        this.reactionTime = 30 * 60 * 1000; // 30 minutes in ms
        this.maintenanceTime = 5 * 60 * 1000; // 5 minutes of maintenance in ms
        this.timer = null; //Timer for running the reaction
        this.inMaintenance = false; // Track if reactor is in maintenance
        this.status = "normal"; // Track the status of the reactor
        this.mqttClient = null; // MQTT client for the reactor
        this.reactorVolume = 100; // Reactor volume in liters
        this.batchId = null;
        this.batchTime = 1800; //Batch runs for 30 mins
    }
    
    openMqttConnection () {

        this.mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883', { clientId: `${this.plantId}-${this.id}`, clean: false }); // Persistent connection
        /*this.mqttClient = mqtt.connect('mqtt://v9e48091.ala.dedicated.aws.emqxcloud.com:1883', 
            { 
                clientId: `${plantId}`, 
                clean: false,
                username: "cdiwadkar",
                password: "!Tdengine1" 

            }); // Persistent connection */

        this.mqttClient.once('connect', () => {
            console.log(`${this.plantId}-${this.id} connected to MQTT broker.`);
        });

        this.mqttClient.once('error', (error) => {
            console.log(`${this.plantId}-${this.id} MQTT connection error: `, error);
        });

    }

    closeMqttConnection () {
        //console.log(`Closing connection for ${this.plantId} ${this.id}`);

        if (this.mqttClient) {
            this.mqttClient.end(true, () => {
                console.log(`MQTT connection for ${this.plantId} ${this.id} closed.`);
            });
            this.mqttClient.removeAllListeners(); // Remove all event listeners
            this.mqttClient = null; // Nullify the reference
        }

    }

    start() {
        const currtime = getCurrentTimestamp();
        const batchid = currtime + "-"+ this.id + "-" + this.plantId;
        this.batchId = batchid;
        this.productionAmount = 0;
        //console.log(`Reactor ${this.id} in Plant ${this.plantId} started ${this.batchId}.`);
        this.inMaintenance = false;
        this.status = "starting";
        this.elapsedTime = 0; // Reset elapsed time
        this.openMqttConnection();
        this.logReactorStartup(); //Log reactor startup status and production amount 0
        //this.startLogging();
        this.timer = setInterval(() => {
            this.startLogging();
            this.runReaction();
        }, 30000); // Update every 30 second in real-time
    }


    runReaction() {
        if (this.inMaintenance) {
            return;
        }
        //Set status = running
        this.status = "running"
        // Calculate reaction rate at current temperature
        let reactionRate = this.calculateReactionRate(); // Rate in mol/(L*min)
        // Amount of product formed in this time step (30 second)
        let deltaProduct = reactionRate * (1 / 60) * 30 * this.reactorVolume; // Convert min to sec and scale by volume
        // Convert moles to liters (assuming 1 mol = 1 L for simplicity)
        this.productionAmount += deltaProduct;
        this.productionAmount += Math.random();
        // Update reactant concentrations (assuming stoichiometry of 1:1:1)
        for (let i = 0; i < this.reactantConcentrations.length; i++) {
            this.reactantConcentrations[i] -= reactionRate * (1 / 60) * 30 * Math.random() * 0.1; // Update per second
            if (this.reactantConcentrations[i] < 0) {
                this.reactantConcentrations[i] = 0;
            }
        }
        // Update internal temperature due to exothermic reaction
        this.internalTemperature += 0.01 * 30 * Math.random(); // Small temperature increase per second

        this.elapsedTime += 30;

        if (this.elapsedTime >= this.batchTime || this.isReactantsDepleted()) {
            console.log(`Reactor ${this.id} in Plant ${this.plantId} produced ${this.productionAmount.toFixed(2)} liters of product.`);
            this.status = "post-batch maintenance";
        }
    }

    calculateReactionRate() {
        const k = 0.01; // Reaction rate constant in L^2/(mol^2*min)
        const activationEnergy = 20000; // Activation energy in J/mol
        const R = 8.314; // Universal gas constant in J/(mol*K)
        const T = this.internalTemperature + 273.15; // Temperature in Kelvin

        // Reactant concentrations in mol/L
        let [A, B, C] = this.reactantConcentrations;

        // If any reactant is depleted, the reaction stops
        if (A <= 0 || B <= 0 || C <= 0) {
            return 0; // No more reaction if any reactant is depleted
        }

        // Calculate reaction rate (assuming reaction is A + B + C -> Product)
        let rate = k * Math.exp(-activationEnergy / (R * T)) * A * B * C; // Rate in mol/(L*min)
        return rate;
    }

    isReactantsDepleted() {
        // Check if reactants are close to being fully depleted
        return this.reactantConcentrations.every(concentration => concentration < 0.01); // 1% threshold
    }

    logReactorStartup() {
        this.checkPumps();
        const [r1,r2,r3] = this.reactantConcentrations;
        this.createAndSendMqttMessage(r1,r2,r3);

    }
    startLogging() {
            this.checkPumps();
	        const [r1,r2,r3] = this.reactantConcentrations;
            this.createAndSendMqttMessage(r1,r2,r3);

            if (this.status === "abnormal shutdown" || this.status === "post-batch maintenance") {
                setTimeout(() => {
                    this.shutdown();
                },10000);
            }
            // Adjust pumps to maintain target flow rates
            this.inletPump.adjustFlowRate();
            this.outletPump.adjustFlowRate();

    }

    checkPumps() {
        // Simulate random temperature changes and check for pump failures
        this.inletPump.changeTemperature();
        this.outletPump.changeTemperature();
        this.inletPump.checkForFailure();
        this.outletPump.checkForFailure();

        if (this.inletPump.failed || this.outletPump.failed) {
            //console.log(`Reactor ${this.id} in Plant ${this.plantId} pump failed! Shutting down for maintenance.`);
            this.status = "abnormal shutdown";
            //this.shutdown("abnormal shutdown");
        }
    }

    shutdown(reason) {
        this.inMaintenance = true;
        //console.log(`Reactor ${this.id} in Plant ${this.plantId} shut down for ${this.status}.`);

        // Reset reactant concentrations and internal temperature for the next batch
        this.reactantConcentrations = [1.0, 1.0, 1.0];
        this.internalTemperature = 25;

        // Stop the reaction update loop
        if (this.timer !== null) {
            clearInterval(this.timer); // Clear the interval timer
            this.timer = null; // Nullify the reference
        }

        this.closeMqttConnection();
        
        setTimeout(() => {
            this.inMaintenance = false;
            this.start();
        }, this.maintenanceTime);

    }

    createAndSendMqttMessage (r1,r2,r3) {

        const logData = {
            region: this.region,
            plantId: this.plantId,  // Add plant ID to log
            reactorId: this.id,
            inletFlowRate: this.inletPump.flowRate,
            inletTemperature: this.inletPump.temperature,
            inletVoltage: this.inletPump.voltage,
            inletRpm: this.inletPump.rpm,
            inletFailed: this.inletPump.failed,
            outFlowRate: this.outletPump.flowRate,
            outTemperature: this.outletPump.temperature,
            outVoltage: this.outletPump.voltage,
            outRpm: this.outletPump.rpm,
            outFailed: this.outletPump.failed,
            reactant1Concentration: r1,
            reactant2Concentration: r2,
            reactant3Concentration: r3,
            pressure: this.pressure,
            internalTemperature: this.internalTemperature,
            productionAmount: this.productionAmount,
            status: this.status,  // Log the current reactor status
            batchid: this.batchId,
            tstamp: new Date().toISOString()
        };

        const topic = `tdereactors`; // Single topic for all reactors
        const message = JSON.stringify(logData);

        this.mqttClient.publish(topic, message, (err) => {
            if (err){
                console.error(`Ran into error while publishing mqtt: ${err}`);
            }
            /* else {
                console.log("published message.")
            }*/
            
        });

    }

}

// Plant class with 10 reactors
class Plant {
    constructor(plantId) {
        this.plantId = plantId;
        let r = [];
        const plant = "";
        r = plantId.toString().split("-");
        this.region = r[0];
        //console.log(`Region is ${this.region}`);
        this.reactors = [];
        for (let i = 0; i < 5; i++) {
            //this.reactors.push(new Reactor(this.region,this.plantId, i + 1, this.mqttClient)); // Pass the MQTT client to each reactor
            this.reactors.push(new Reactor(this.region,this.plantId, i + 1)); // Pass the MQTT client to each reactor
        }
    }

    start() {
        this.reactors.forEach(reactor => reactor.start());
    }
}

// Main System with 5 Plants
class System {
    constructor(regions) {
        this.plants = [];
        if (regions.NA.length > 0) {
            regions.NA.forEach(plantid => this.plants.push(new Plant(plantid)));
        }
        if (regions.SA.length > 0) {
            regions.SA.forEach(plantid => this.plants.push(new Plant(plantid)));
            //this.plants.push(new Plant(regions.SA));
        }
        if (regions.EU.length > 0) {
            regions.EU.forEach(plantid => this.plants.push(new Plant(plantid)));
        }
        //console.log(`Will start ${this.plants.length} plants.`)
    }

    start() {
       this.plants.forEach(plant => plant.start());
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

// Initialize the system of plants
const NA = ["US-RTP","US-Kalamazoo"]
const EU = ["EU-Darmstadt","EU-Southampton"]
const SA = ["SA-Cartagena","SA-Aracruz"]
const input = ['NA','EU','SA','ALL'];
const regions = {
    NA: [],
    EU: [],
    SA: []
};

/*var index = readline.keyInSelect(input,'Which region(s) do you want to start?')

if (input[index] === 'NA') {
    //regions.NA.push(NA);
    regions.NA = [...NA];
    console.log(regions.NA)
    console.log("Starting NA plants.")
}
else if (input[index] === 'EU') {
    regions.EU = [...EU];
    console.log(regions.EU)
    console.log("Starting EU plants.")
}
else if (input[index] === 'SA') {
    regions.SA = [...SA];
    console.log(regions.SA)
    console.log("Starting SA plants.")
}
else if (input[index] === 'ALL') {
    regions.NA = [...NA];
    regions.EU = [...EU];
    regions.SA = [...SA];
    console.log("Starting ALL plants.")
}
else {
    console.log("Exiting demo.");
}
*/
regions.NA = [...NA];
regions.EU = [...EU];
regions.SA = [...SA];
const system = new System(regions);
system.start();