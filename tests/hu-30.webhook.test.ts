/**
 * HU-30: Tests del webhook de aprobación.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendApprovalWebhook } from "../src/lib/webhook";

const mockRequest = {
  id: "req-001",
  title: "Prueba webhook",
  totalAmount: 1500000,
  costCenter: "CC-TI",
  companyId: "company-001",
};

const mockActor = {
  id: "user-001",
  name: "Juan Jefatura",
  role: "MANAGER",
};

describe("HU-30: sendApprovalWebhook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("no llama fetch si WEBHOOK_URL no está definida", async () => {
    vi.stubEnv("WEBHOOK_URL", "");
    await sendApprovalWebhook(mockRequest, mockActor);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("llama fetch con POST y body correcto cuando WEBHOOK_URL está definida", async () => {
    vi.stubEnv("WEBHOOK_URL", "https://example.com/webhook");
    await sendApprovalWebhook(mockRequest, mockActor);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.event).toBe("purchase_request.approved");
    expect(body.data.id).toBe("req-001");
    expect(body.data.totalAmount).toBe(1500000);
    expect(body.data.approvedBy.role).toBe("MANAGER");
    expect(typeof body.timestamp).toBe("string");
  });

  it("no relanza el error si fetch falla (fire-and-forget)", async () => {
    vi.stubEnv("WEBHOOK_URL", "https://example.com/webhook");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // No debe lanzar error
    await expect(sendApprovalWebhook(mockRequest, mockActor)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("el payload incluye timestamp en formato ISO", async () => {
    vi.stubEnv("WEBHOOK_URL", "https://example.com/webhook");
    await sendApprovalWebhook(mockRequest, mockActor);

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("convierte totalAmount a número aunque llegue como string", async () => {
    vi.stubEnv("WEBHOOK_URL", "https://example.com/webhook");
    await sendApprovalWebhook({ ...mockRequest, totalAmount: "750000" as unknown as number }, mockActor);

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(typeof body.data.totalAmount).toBe("number");
    expect(body.data.totalAmount).toBe(750000);
  });
});

