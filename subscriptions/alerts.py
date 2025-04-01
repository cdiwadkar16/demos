from twilio.rest import Client
import os
import time
from taosws import Consumer

account_sid = 'AC147eee0ced720db1c06825ff7b9ade6c'
auth_token = '12e6e5c30ec1ec068415ce95cc85c660'
client = Client(account_sid, auth_token)

endpoint = os.environ["TDENGINE_CLOUD_ENDPOINT"]
token = os.environ["TDENGINE_CLOUD_TOKEN"]

conf = {
    # auth options
    "td.connect.websocket.scheme": "wss",
  "td.connect.ip": endpoint,
  "td.connect.token": token,
  # consume options
  "group.id": "topicconsumers",
  "client.id": "tdform2_ws_py",
  "enable.auto.commit": "true",
  "auto.commit.interval.ms": "10",
  "auto.offset.reset": "latest",
  "msg.with.table.name": "true",
}
consumer = Consumer(conf)

consumer.subscribe(["solarpaneloutput"])

while 1:
    message = consumer.poll()
    if message:
        id = message.vgroup()
        topic = message.topic()
        database = message.database()

        for block in message:
            nrows = block.nrows()
            ncols = block.ncols()
            for row in block:
                print(row)
                msgbody = f"Alert {row[3]} {row[2]} at {row[0]} power {row[1]}"
                print(msgbody)
                txtmessage = client.messages.create(
                    from_='+18557981618',
                    body=msgbody,
                    to='+14156830525'
                )
                print(txtmessage.sid)
    else:
        print("Nothing yet")
