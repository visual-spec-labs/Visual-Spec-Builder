import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv/dist/2020";

import visualSpecJsonSchema from "@/features/editor/schema/visual-spec.schema.json";

import ticketJsonSchema from "./ticket.schema.json";

export interface TicketValidationIssue {
  code: "schema";
  path: string;
  message: string;
}

export interface TicketValidationResult {
  valid: boolean;
  issues: TicketValidationIssue[];
}

type CompiledValidator = ReturnType<InstanceType<typeof Ajv2020>["compile"]>;

let ticketValidator: CompiledValidator | undefined;
let ticketsValidator: CompiledValidator | undefined;

function createAjv(): InstanceType<typeof Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(visualSpecJsonSchema, "visual-spec");
  ajv.addSchema(ticketJsonSchema, "ticket-schema");
  return ajv;
}

function getTicketValidator(): CompiledValidator {
  ticketValidator ??= createAjv().compile({ $ref: "ticket-schema#/$defs/Ticket" });
  return ticketValidator;
}

function getTicketsValidator(): CompiledValidator {
  ticketsValidator ??= createAjv().compile({ $ref: "ticket-schema#/$defs/Tickets" });
  return ticketsValidator;
}

function describe(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case "required":
      return `필수 필드 "${params.missingProperty}"가 없습니다.`;
    case "additionalProperties":
      return `허용되지 않는 필드 "${params.additionalProperty}"가 있습니다.`;
    case "enum":
      return `허용된 값(${(params.allowedValues as unknown[]).map(String).join(", ")}) 중 하나여야 합니다.`;
    case "type":
      return `값의 타입이 "${params.type}"이어야 합니다.`;
    case "minLength":
      return `문자열이 비어 있을 수 없습니다.`;
    case "pattern":
      return "Visual Spec의 NodeId 형식이어야 합니다.";
    default:
      return `Ticket 스키마 규칙(${error.keyword})을 위반했습니다.`;
  }
}

function runValidator(input: unknown, validator: CompiledValidator): TicketValidationResult {
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
          : [{ code: "schema", path: "/", message: "Ticket 스키마 검증에 실패했습니다." }],
    };
  } catch {
    return {
      valid: false,
      issues: [{ code: "schema", path: "/", message: "Ticket 스키마 검증 중 오류가 발생했습니다." }],
    };
  }
}

/** 신뢰할 수 없는 값이 Ticket 형태 계약을 만족하는지 검사한다. 예외 대신 issues를 돌려준다. */
export function validateTicket(input: unknown): TicketValidationResult {
  return runValidator(input, getTicketValidator());
}

/** Ticket 목록 형태를 검사한다. 목록 안의 각 Ticket 오류 경로는 배열 인덱스를 포함한다. */
export function validateTickets(input: unknown): TicketValidationResult {
  return runValidator(input, getTicketsValidator());
}
