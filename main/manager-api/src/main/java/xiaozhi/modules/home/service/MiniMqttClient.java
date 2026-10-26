package xiaozhi.modules.home.service;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

import javax.net.ssl.SSLSocketFactory;

/**
 * A minimal MQTT 3.1.1 client for the generic smart-home devices: connect (user name and password
 * optional, TLS optional), publish one QoS 0 message, disconnect. No library: the module only
 * ever sends a single on/off payload. Tested against a fake broker in MiniMqttClientTest.
 */
public class MiniMqttClient {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final int timeoutMs;

    public MiniMqttClient() {
        this(5000);
    }

    public MiniMqttClient(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    /** Broker settings; password is the plain secret (decrypted by the caller). */
    public record Broker(String host, int port, String username, String password, boolean tls) {
    }

    /** Connect and disconnect: is the broker there and are the credentials accepted? */
    public HomeResult check(Broker broker) {
        return run(broker, null, null);
    }

    /** Publish one message (QoS 0, not retained). */
    public HomeResult publish(Broker broker, String topic, String payload) {
        if (topic == null || topic.isBlank() || topic.contains("#") || topic.contains("+")) {
            return HomeResult.fail("bad_value", "The MQTT topic is empty or has wildcards");
        }
        return run(broker, topic, payload == null ? "" : payload);
    }

    private HomeResult run(Broker broker, String topic, String payload) {
        if (broker == null || broker.host() == null || broker.host().isBlank()) {
            return HomeResult.fail("not_configured", "The MQTT broker is not set up");
        }
        int port = broker.port() > 0 ? broker.port() : (broker.tls() ? 8883 : 1883);
        if (port > 65535) {
            return HomeResult.fail("bad_url", "The MQTT port is not valid");
        }
        Socket socket = null;
        try {
            socket = broker.tls() ? SSLSocketFactory.getDefault().createSocket() : new Socket();
            socket.connect(new InetSocketAddress(broker.host().trim(), port), timeoutMs);
            socket.setSoTimeout(timeoutMs);
            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();
            out.write(connectPacket(broker.username(), broker.password()));
            out.flush();
            int rc = readConnack(in);
            if (rc == 4 || rc == 5) {
                return HomeResult.fail("unauthorized", "The MQTT broker refused the user name or password");
            }
            if (rc != 0) {
                return HomeResult.fail("error", "The MQTT broker refused the connection (code " + rc + ")");
            }
            if (topic != null) {
                out.write(publishPacket(topic, payload));
            }
            out.write(new byte[] { (byte) 0xE0, 0x00 });
            out.flush();
            return topic == null ? HomeResult.ok("MQTT broker answered") : HomeResult.ok("Published").with("topic", topic);
        } catch (UnknownHostException | ConnectException | SocketTimeoutException e) {
            return HomeResult.fail("unreachable", "The MQTT broker did not answer");
        } catch (IOException e) {
            return HomeResult.fail("unreachable", "The MQTT broker could not be reached: " + e.getClass().getSimpleName());
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (IOException ignored) {
                    // closing anyway
                }
            }
        }
    }

    static byte[] connectPacket(String username, String password) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeString(body, "MQTT");
        body.write(4); // protocol level 3.1.1
        boolean user = username != null && !username.isEmpty();
        boolean pass = user && password != null && !password.isEmpty();
        int flags = 0x02 | (user ? 0x80 : 0) | (pass ? 0x40 : 0);
        body.write(flags);
        body.write(0);
        body.write(30); // keep alive seconds
        writeString(body, "nobix-home-" + Long.toHexString(RANDOM.nextLong() & 0xffffffffL));
        if (user) {
            writeString(body, username);
        }
        if (pass) {
            writeString(body, password);
        }
        return packet(0x10, body.toByteArray());
    }

    static byte[] publishPacket(String topic, String payload) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeString(body, topic);
        byte[] p = payload.getBytes(StandardCharsets.UTF_8);
        body.write(p, 0, p.length);
        return packet(0x30, body.toByteArray());
    }

    private static int readConnack(InputStream in) throws IOException {
        int type = read(in);
        int len = read(in);
        if (type != 0x20 || len != 2) {
            throw new IOException("not a CONNACK");
        }
        read(in); // session present
        return read(in);
    }

    private static int read(InputStream in) throws IOException {
        int b = in.read();
        if (b < 0) {
            throw new EOFException();
        }
        return b;
    }

    private static byte[] packet(int type, byte[] body) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(type);
        int len = body.length;
        do {
            int digit = len % 128;
            len /= 128;
            if (len > 0) {
                digit |= 0x80;
            }
            out.write(digit);
        } while (len > 0);
        out.write(body, 0, body.length);
        return out.toByteArray();
    }

    private static void writeString(ByteArrayOutputStream out, String s) {
        byte[] b = s.getBytes(StandardCharsets.UTF_8);
        out.write((b.length >> 8) & 0xFF);
        out.write(b.length & 0xFF);
        out.write(b, 0, b.length);
    }
}
