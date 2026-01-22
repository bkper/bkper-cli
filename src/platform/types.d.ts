/**
 * Bkper Platform API Types
 * 
 * Auto-generated from OpenAPI spec.
 * Regenerate with: bun run api:platform
 * 
 * @see https://platform.bkper.app/openapi.json
 */

export interface paths {
  "/api/health": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              status: "ok";
              timestamp: string;
            };
          };
        };
      };
    };
  };
  "/api/apps/{appId}": {
    get: {
      parameters: {
        path: {
          appId: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["AppStatus"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
    delete: {
      parameters: {
        path: {
          appId: string;
        };
        query: {
          env?: "prod" | "dev";
          type?: "web" | "events";
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["UndeployResult"];
          };
        };
        400: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        502: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
  "/api/apps/{appId}/deploy": {
    post: {
      parameters: {
        path: {
          appId: string;
        };
        query: {
          env?: "prod" | "dev";
          type?: "web" | "events";
        };
      };
      requestBody: {
        content: {
          "application/octet-stream": string;
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["DeployResult"];
          };
        };
        400: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        502: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    DeployResult: {
      success: true;
      url: string;
      environment: "prod" | "dev";
      type: "web" | "events";
      namespace: string;
      scriptName: string;
      updatedAt: string;
    };
    UndeployResult: {
      success: true;
      message: string;
      namespace: string;
      scriptName: string;
    };
    ScriptStatus: {
      deployed: boolean;
      url: string;
      scriptName: string;
      namespace: string;
      updatedAt?: string;
    } | null;
    EnvStatus: {
      web: components["schemas"]["ScriptStatus"];
      events: components["schemas"]["ScriptStatus"];
    };
    AppStatus: {
      appId: string;
      prod: components["schemas"]["EnvStatus"];
      dev: components["schemas"]["EnvStatus"];
    };
    ErrorResponse: {
      success: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
    };
  };
}

export type $defs = Record<string, never>;

export type operations = Record<string, never>;
