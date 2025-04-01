import sys
import os
import taosrest
import fnmatch
from dotenv import load_dotenv
from datetime import datetime
from datetime import timezone
import time

'''Environment'''
url = os.environ["TDENGINE_CLOUD_URL"]
token = os.environ["TDENGINE_CLOUD_TOKEN"]


''' create connection '''
conn = taosrest.connect(url=url, token=token,timezone="America/Los_Angeles")

fileName = "sample.csv"
totalLines = 0
af = 0
assetid = sys.argv[1]
operatorid = sys.argv[2]
sleepinterval = int(sys.argv[3])

infile = open(fileName,'r')

for eachline in infile:
    totalLines += 1
    myfields = eachline.split(',')
    tablename = 'asset'+ assetid
    '''print("Table name is:", tablename)'''
    dt = datetime.now(timezone.utc);
    strdt = dt.strftime("%Y-%m-%d %H:%M:%S.%f")
    '''print("timestamp is:", strdt)'''
    insertstr = 'insert into mobileassets.'+tablename+' using mobileassets.haulasset tags ('
    insertstr += "'"+assetid+"') values ("
    insertstr += "'"+strdt+"',"
    insertstr += "'"+operatorid+"',"
    insertstr += myfields[2]+','
    insertstr += myfields[3]+','
    insertstr += myfields[4]+','
    insertstr += myfields[5]+','
    insertstr += myfields[6]+','
    insertstr += myfields[7]+','
    insertstr += myfields[8]+','
    insertstr += myfields[9]+','
    insertstr += myfields[10]+','
    insertstr += myfields[11]+','
    insertstr += myfields[12]+','
    insertstr += myfields[13].strip()+')'
    '''print(insertstr)'''
    af += conn.execute(insertstr)
    time.sleep(sleepinterval)

infile.close()
'''print('Total lines'+str(totalLines)+' so far\n')
print('Inserted '+str(af)+' so far\n')'''
