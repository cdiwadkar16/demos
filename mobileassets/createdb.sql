CREATE DATABASE mobileassets;
USE mobileassets;
CREATE STABLE mobileassets.haulasset (
	ts TIMESTAMP,
	operatorid VARCHAR(4),
	latitude FLOAT,
	longitude FLOAT,
	airFilterDiffPress FLOAT,
	airInletPress FLOAT,
	crankCasePress FLOAT,
	speed FLOAT,
	gear SMALLINT,
	rpm SMALLINT,
	load FLOAT,
	fuelRemaining FLOAT,
	cabinSoundLevel FLOAT,
	cabinTemp FLOAT
) 
TAGS (
	assetid VARCHAR(20),
);
