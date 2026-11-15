/**
 * 점 표기 경로("layout.gap", "box.width")로 객체를 읽고,
 * 원본을 변형하지 않는 불변 복사본에 값을 쓴다.
 * 스토어의 setNodeField와 패널의 useNodeField가 함께 쓴다.
 */

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 경로가 가리키는 값을 반환한다. 중간 경로가 없으면 undefined. */
export function getByPath(target: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (isRecord(acc)) {
      return acc[key];
    }
    return undefined;
  }, target);
}

/**
 * 경로 위치에 값을 설정한 새 객체를 반환한다(불변).
 * 경로가 지나는 각 단계만 얕게 복사하고 나머지는 참조를 유지한다.
 */
export function setByPath<T>(target: T, path: string, value: unknown): T {
  const obj = (isRecord(target) ? target : {}) as UnknownRecord;
  const [head, ...rest] = path.split(".");

  if (rest.length === 0) {
    return { ...obj, [head]: value } as T;
  }

  const child = obj[head];
  const nextChild = setByPath(isRecord(child) ? child : {}, rest.join("."), value);

  return { ...obj, [head]: nextChild } as T;
}
