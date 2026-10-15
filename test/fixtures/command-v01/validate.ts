import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv/dist/2020";

import visualSpecJsonSchema from "@/features/editor/schema/visual-spec.schema.json";

import commandJsonSchema from "./command.schema.json";

export interface CommandValidationIssue {
  code: "schema";
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
      return "Command 6종 중 어느 형식과도 일치하지 않습니다.";
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

/**
 * #265 S1-1 임시 가드 — **S1-3에서 제거한다.**
 *
 * createNode의 node는 정본 Node를 그대로 $ref하므로, 스키마에 `ButtonNode.action`이
 * 들어오면 action이 붙은 button을 받는다. editablePath의 updateNode·updateScreen 가드와
 * 같은 이유로, 바깥에서 들어오는 Command(자연어·에이전트 편집의 G1)가 참조 무결성
 * 검증(S1-2)과 Command 계약(S1-3) 전에 action을 들여오지 못하게 막는다.
 * GUI 복제(buildDuplicateCommands)처럼 앱 안에서 만든 createNode는 이 입구를 거치지
 * 않으므로, 불러온 문서에 이미 있는 action은 그대로 보존된다.
 */
function relationFieldIssues(commands: readonly unknown[], basePath: string): CommandValidationIssue[] {
  return commands.flatMap((command, index) => {
    const path = basePath === "" ? "" : `${basePath}/${index}`;
    const { type, node } = command as { type?: unknown; node?: unknown };
    if (type !== "createNode" || typeof node !== "object" || node === null) return [];
    if (!Object.prototype.hasOwnProperty.call(node, "action")) return [];
    return [{
      code: "schema" as const,
      path: `${path}/node/action`,
      message: "action은 아직 Command로 만들 수 없습니다(#265 S1-3 전).",
    }];
  });
}

/** Command 하나의 JSON 형태를 검사한다. 절대 예외를 던지지 않는다. */
export function validateCommand(input: unknown): CommandValidationResult {
  const result = runValidator(input, getCommandValidator());
  if (!result.valid) return result;
  const issues = relationFieldIssues([input], "");
  return issues.length === 0 ? result : { valid: false, issues };
}

/** 자연어 출력의 Transaction 형태와 명령 수(1–100)를 검사한다. */
export function validateTransaction(input: unknown): CommandValidationResult {
  const result = runValidator(input, getTransactionValidator());
  if (!result.valid) return result;
  const issues = relationFieldIssues((input as { commands: unknown[] }).commands, "/commands");
  return issues.length === 0 ? result : { valid: false, issues };
}
