import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv/dist/2020";

import visualSpecJsonSchema from "@/features/editor/schema/visual-spec.schema.json";

import { COMMAND_VERSION } from "./types";

import commandJsonSchema from "./command.schema.json";

export interface CommandValidationIssue {
  code: "schema" | "version";
  path: string;
  message: string;
}

export interface CommandValidationResult {
  valid: boolean;
  issues: CommandValidationIssue[];
}

type CompiledValidator = ReturnType<InstanceType<typeof Ajv2020>["compile"]>;

let commandValidator: CompiledValidator | undefined;
let transactionValidator: CompiledValidator | undefined;

function createAjv(): InstanceType<typeof Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(visualSpecJsonSchema, "visual-spec");
  ajv.addSchema(commandJsonSchema, "command-schema");
  return ajv;
}

function getCommandValidator(): CompiledValidator {
  commandValidator ??= createAjv().compile({
    $ref: "command-schema#/$defs/Command",
  });
  return commandValidator;
}

function getTransactionValidator(): CompiledValidator {
  transactionValidator ??= createAjv().compile({ $ref: "command-schema" });
  return transactionValidator;
}

function describe(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case "required":
      return `필수 필드 "${params.missingProperty}"가 없습니다.`;
    case "additionalProperties":
      return `허용되지 않는 필드 "${params.additionalProperty}"가 있습니다.`;
    case "const":
      return `값이 ${JSON.stringify(params.allowedValue)}이어야 합니다.`;
    case "type":
      return `값의 타입이 "${params.type}"이어야 합니다.`;
    case "minimum":
      return `값이 ${params.limit} 이상이어야 합니다.`;
    case "minLength":
      return `문자열이 너무 짧습니다 (최소 길이: ${params.limit}).`;
    case "minItems":
    case "maxItems":
      return `배열 길이가 허용 범위를 벗어났습니다 (${error.keyword}: ${params.limit}).`;
    case "oneOf":
      return "정의된 Command 형식 중 어느 것과도 일치하지 않습니다.";
    default:
      return `Command 스키마 규칙(${error.keyword})을 위반했습니다.`;
  }
}

function runValidator(
  input: unknown,
  validator: CompiledValidator,
): CommandValidationResult {
  try {
    if (validator(input)) return { valid: true, issues: [] };

    const issues = (validator.errors ?? []).map((error) => ({
      code: "schema" as const,
      path: error.instancePath || "/",
      message: describe(error),
    }));
    return {
      valid: false,
      issues:
        issues.length > 0
          ? issues
          : [
              {
                code: "schema",
                path: "/",
                message: "Command 스키마 검증에 실패했습니다.",
              },
            ],
    };
  } catch {
    return {
      valid: false,
      issues: [
        {
          code: "schema",
          path: "/",
          message: "Command 입력을 검증하는 중 오류가 발생했습니다.",
        },
      ],
    };
  }
}

/** Command 하나의 형태 검사. 외부 입력은 반드시 Transaction 버전 관문을 먼저 거친다. */
export function validateCommand(input: unknown): CommandValidationResult {
  return runValidator(input, getCommandValidator());
}

export function validateTransaction(input: unknown): CommandValidationResult {
  try {
    const version = typeof input === "object" && input !== null ? (input as Record<string, unknown>).version : undefined;
    if (version !== COMMAND_VERSION) return {
      valid: false,
      issues: [{ code: "version", path: "/version", message: `Command 버전이 다릅니다(기대: ${COMMAND_VERSION}, 받음: ${JSON.stringify(version) ?? "없음"}). GUI와 visual-spec skills를 업데이트하세요.` }],
    };
    return runValidator(input, getTransactionValidator());
  } catch {
    return { valid: false, issues: [{ code: "schema", path: "/", message: "Command 입력을 검증하는 중 오류가 발생했습니다." }] };
  }
}
