package xiaozhi.modules.home;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/** A tiny Home Assistant stand-in for the tests: /api/config, /api/states, /api/services/... */
class FakeHomeAssistant implements AutoCloseable {
    static final String TOKEN = "test-long-lived-token";
    static final String STATES = "["
            + "{\"entity_id\":\"light.living_room\",\"state\":\"on\",\"attributes\":{\"friendly_name\":\"Living Room Light\"}},"
            + "{\"entity_id\":\"fan.bedroom\",\"state\":\"off\",\"attributes\":{\"friendly_name\":\"Bedroom Fan\"}},"
            + "{\"entity_id\":\"climate.ac\",\"state\":\"cool\",\"attributes\":{\"friendly_name\":\"AC\"}},"
            + "{\"entity_id\":\"sensor.temp\",\"state\":\"28\",\"attributes\":{\"friendly_name\":\"Temperature\"}},"
            + "{\"entity_id\":\"switch.kettle\",\"state\":\"off\",\"attributes\":{}}"
            + "]";

    record Call(String path, String body) {
    }

    final List<Call> calls = new CopyOnWriteArrayList<>();
    private final HttpServer server;

    FakeHomeAssistant() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void handle(HttpExchange ex) throws IOException {
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String path = ex.getRequestURI().getPath();
        calls.add(new Call(path, body));
        if (!("Bearer " + TOKEN).equals(ex.getRequestHeaders().getFirst("Authorization"))) {
            reply(ex, 401, "{\"message\":\"Invalid authentication\"}");
            return;
        }
        if (path.equals("/api/config")) {
            reply(ex, 200, "{\"version\":\"2026.10.1\",\"location_name\":\"Home\"}");
        } else if (path.equals("/api/states")) {
            reply(ex, 200, STATES);
        } else if (path.startsWith("/api/services/")) {
            reply(ex, 200, "[]");
        } else {
            reply(ex, 404, "{}");
        }
    }

    private static void reply(HttpExchange ex, int status, String json) throws IOException {
        byte[] b = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, b.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(b);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
