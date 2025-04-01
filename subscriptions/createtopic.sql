CREATE TOPIC solarpaneloutput AS SELECT `ts`,`avgpower`,`string`,`panelid` FROM `renewables`.`p5` WHERE avgpower < 10
