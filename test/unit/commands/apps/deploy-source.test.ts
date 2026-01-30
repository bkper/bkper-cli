import { expect, getTestPaths } from "../../helpers/test-setup.js";

const { __dirname } = getTestPaths(import.meta.url);

describe("CLI - apps deploy source paths", function () {
    let resolveSourceDeployPaths: typeof import("../../../../src/commands/apps/deploy.js").resolveSourceDeployPaths;

    before(async function () {
        const deployModule = await import("../../../../src/commands/apps/deploy.js");
        resolveSourceDeployPaths = deployModule.resolveSourceDeployPaths;
    });

    it("should resolve web bundle and assets paths", function () {
        const result = resolveSourceDeployPaths("web", {
            web: {
                main: "packages/web/server/src/index.ts",
                client: "packages/web/client",
            },
        });

        expect(result.bundlePath).to.include("dist/web/server/index.js");
        expect(result.bundleDir).to.include("dist/web/server");
        expect(result.assetsDir).to.include("dist/web/client");
    });

    it("should resolve events bundle paths", function () {
        const result = resolveSourceDeployPaths("events", {
            events: {
                main: "packages/events/src/index.ts",
            },
        });

        expect(result.bundlePath).to.include("dist/events/index.js");
        expect(result.bundleDir).to.include("dist/events");
        expect(result.assetsDir).to.be.undefined;
    });

    it("should throw when web handler is missing", function () {
        expect(() =>
            resolveSourceDeployPaths("web", {
                events: { main: "packages/events/src/index.ts" },
            })
        ).to.throw("No web handler configured");
    });
});
