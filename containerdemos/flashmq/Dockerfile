# Use the official FlashMQ image
FROM privatecoder/flashmq:latest

#copy flashmq.conf for anonymous login

COPY flashmq.conf /etc/flashmq/

# Expose the necessary ports
EXPOSE 1883

CMD ["/bin/flashmq"]
