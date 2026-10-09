import { stripVTControlCharacters } from "node:util";

/** 색 코드가 청크 경계에서 나뉘어도 누적한 출력에서 준비 URL을 찾는다. */
export function waitForViteUrl(server, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const finish = (error, url) => {
      clearTimeout(timer);
      server.off("error", onError);
      server.off("exit", onExit);
      server.stdout.off("data", onStdout);
      server.stderr.off("data", onStderr);
      if (error) reject(error);
      else resolve(url);
    };
    const onError = error => finish(error);
    const onExit = code => finish(new Error(`Vite exited ${code}: ${output}`));
    const onStderr = chunk => { output += chunk; };
    const onStdout = chunk => {
      output += chunk;
      const match = stripVTControlCharacters(output).match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) finish(null, match[0]);
    };
    const timer = setTimeout(() => finish(new Error(`Vite startup timed out: ${output}`)), timeoutMs);
    server.once("error", onError);
    server.once("exit", onExit);
    server.stderr.on("data", onStderr);
    server.stdout.on("data", onStdout);
  });
}
