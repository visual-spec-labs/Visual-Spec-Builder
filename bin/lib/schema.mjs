// 이 파일은 src/features/editor/schema 에서 자동 생성됩니다(이슈 #278).
// 손으로 수정하지 마세요. 재생성: pnpm generate:contract
import Ajv2020 from "ajv/dist/2020.js";
var visual_spec_schema_default = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	title: "VisualSpec",
	description: "Visual Spec Schema v0.3 — 파일 1개 = Screen 1개. Auto Layout 전용, 절대좌표 없음. 0.1 문서는 앱이 열 때 0.3으로 변환한다(schema/migrate.ts).",
	type: "object",
	additionalProperties: false,
	required: ["version", "screen"],
	properties: {
		"version": { "const": "0.3" },
		"screen": { "$ref": "#/$defs/ScreenSpec" }
	},
	$defs: /* @__PURE__ */ JSON.parse("{\"ScreenSpec\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"name\",\"size\",\"root\",\"nodes\"],\"properties\":{\"name\":{\"type\":\"string\",\"minLength\":1},\"size\":{\"type\":\"object\",\"description\":\"Screen 크기. width/height 모두 exclusiveMinimum 0.\",\"additionalProperties\":false,\"required\":[\"width\",\"height\"],\"properties\":{\"width\":{\"type\":\"number\",\"exclusiveMinimum\":0},\"height\":{\"type\":\"number\",\"exclusiveMinimum\":0}}},\"root\":{\"$ref\":\"#/$defs/NodeId\"},\"nodes\":{\"type\":\"object\",\"minProperties\":1,\"propertyNames\":{\"pattern\":\"^[A-Za-z0-9_-]+$\"},\"additionalProperties\":{\"$ref\":\"#/$defs/Node\"}},\"responsive\":{\"$ref\":\"#/$defs/Responsive\",\"description\":\"생략하면 기존 단일 레이아웃이다. 기본 nodes 위에 minWidthPx 오름차순으로 희소 override를 누적한다. GUI·코드 생성 지원과는 별도 계약이다.\"},\"kind\":{\"$ref\":\"#/$defs/ScreenKind\"}}},\"ScreenKind\":{\"type\":\"string\",\"description\":\"화면 종류(#265). 생략하면 \\\"page\\\"다 — 기존 문서는 모두 일반 페이지로 읽힌다. 첫 화면은 page여야 한다는 규칙과 kind별 size 해석은 이 스키마가 아니라 프로젝트 검증·후속 계약이 정한다(docs/24-screen-relations-design.md).\",\"enum\":[\"page\",\"modal\",\"widget\"]},\"ProjectSpec\":{\"description\":\"Visual Spec v0.3 — 파일 1개 = 프로젝트 1개(페이지 여러 개). 각 페이지는 화면 문서와 같은 ScreenSpec이다. 버전은 IR 세대를 뜻하고, 화면 문서와는 버전이 아니라 키(screen / pages)로 구별한다. 0.2 문서는 앱이 열 때 0.3으로 변환한다.\",\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"version\",\"name\",\"pages\",\"pageOrder\"],\"properties\":{\"version\":{\"const\":\"0.3\"},\"name\":{\"type\":\"string\",\"minLength\":1},\"pages\":{\"type\":\"object\",\"minProperties\":1,\"propertyNames\":{\"pattern\":\"^[A-Za-z0-9_-]+$\"},\"additionalProperties\":{\"$ref\":\"#/$defs/ScreenSpec\"}},\"pageOrder\":{\"description\":\"pages의 키와 정확히 일치해야 한다. JSON Schema로는 표현할 수 없어 validateProjectSpec이 page-order-mismatch로 검사한다.\",\"type\":\"array\",\"minItems\":1,\"uniqueItems\":true,\"items\":{\"$ref\":\"#/$defs/PageId\"}}}},\"PageId\":{\"type\":\"string\",\"minLength\":1,\"pattern\":\"^[A-Za-z0-9_-]+$\"},\"Size\":{\"description\":\"number | \\\"auto\\\" | \\\"fill\\\". number는 minimum 0, px로 해석. \\\"fill\\\"의 교차축 해석(align-self: stretch)은 docs/06-schema-freeze.md 참고.\",\"oneOf\":[{\"type\":\"number\",\"minimum\":0},{\"type\":\"string\",\"enum\":[\"auto\",\"fill\"]}]},\"NodeId\":{\"type\":\"string\",\"minLength\":1,\"pattern\":\"^[A-Za-z0-9_-]+$\"},\"Node\":{\"oneOf\":[{\"$ref\":\"#/$defs/FrameNode\"},{\"$ref\":\"#/$defs/TextNode\"},{\"$ref\":\"#/$defs/ImageNode\"},{\"$ref\":\"#/$defs/ButtonNode\"},{\"$ref\":\"#/$defs/InputNode\"}]},\"FrameNode\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"type\",\"name\",\"box\",\"layout\",\"children\"],\"properties\":{\"type\":{\"const\":\"frame\"},\"name\":{\"type\":\"string\",\"minLength\":1},\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/Box\"},\"layout\":{\"$ref\":\"#/$defs/Layout\"},\"background\":{\"$ref\":\"#/$defs/Background\"},\"border\":{\"$ref\":\"#/$defs/Border\"},\"shadow\":{\"$ref\":\"#/$defs/Shadow\"},\"opacity\":{\"$ref\":\"#/$defs/Opacity\"},\"blur\":{\"$ref\":\"#/$defs/Blur\"},\"children\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/$defs/ChildReference\"}}}},\"TextNode\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"type\",\"name\",\"box\",\"content\",\"typography\",\"color\"],\"properties\":{\"type\":{\"const\":\"text\"},\"name\":{\"type\":\"string\",\"minLength\":1},\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/Box\"},\"content\":{\"type\":\"string\"},\"typography\":{\"$ref\":\"#/$defs/Typography\"},\"color\":{\"$ref\":\"#/$defs/Color\"},\"opacity\":{\"$ref\":\"#/$defs/Opacity\"},\"blur\":{\"$ref\":\"#/$defs/Blur\"}}},\"ImageNode\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"type\",\"name\",\"box\",\"src\",\"fit\"],\"properties\":{\"type\":{\"const\":\"image\"},\"name\":{\"type\":\"string\",\"minLength\":1},\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/Box\"},\"src\":{\"type\":\"string\",\"minLength\":1,\"description\":\"이미지 참조. 세 가지가 들어온다 — 워크스페이스 assets 기준 상대 경로(assets/hero.png), assetId, 그리고 base64 data URI(data:image/png;base64,...). File ▸ Import는 이미지를 .visual-spec/assets/에 저장하고 **상대 경로**를 넣는다(이슈 #133). data URI는 그 이전에 만들어진 스펙과, 작업공간이 없을 때의 폴백으로 남아 있다 — 계속 유효하다(06-schema-freeze.md 참고). 제약은 비지 않은 문자열뿐이라 어느 형태인지는 읽는 쪽이 구분한다.\"},\"fit\":{\"type\":\"string\",\"description\":\"MVP는 object-fit 방식만.\",\"enum\":[\"cover\",\"contain\",\"fill\"]},\"opacity\":{\"$ref\":\"#/$defs/Opacity\"},\"blur\":{\"$ref\":\"#/$defs/Blur\"}}},\"ButtonNode\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"type\",\"name\",\"box\",\"content\",\"typography\",\"color\"],\"properties\":{\"type\":{\"const\":\"button\"},\"name\":{\"type\":\"string\",\"minLength\":1},\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/Box\"},\"content\":{\"type\":\"string\",\"minLength\":1,\"description\":\"버튼 라벨.\"},\"typography\":{\"$ref\":\"#/$defs/Typography\"},\"color\":{\"$ref\":\"#/$defs/Color\"},\"background\":{\"$ref\":\"#/$defs/Background\"},\"border\":{\"$ref\":\"#/$defs/Border\"},\"action\":{\"$ref\":\"#/$defs/Action\"}}},\"InputNode\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"type\",\"name\",\"box\",\"placeholder\",\"typography\",\"color\"],\"properties\":{\"type\":{\"const\":\"input\"},\"name\":{\"type\":\"string\",\"minLength\":1},\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/Box\"},\"placeholder\":{\"type\":\"string\",\"description\":\"MVP는 표시용 placeholder 텍스트만 있다. value·onChange 같은 바인딩은 없다(props/bindings는 MVP 제외 범위).\"},\"typography\":{\"$ref\":\"#/$defs/Typography\"},\"color\":{\"$ref\":\"#/$defs/Color\"},\"background\":{\"$ref\":\"#/$defs/Background\"},\"border\":{\"$ref\":\"#/$defs/Border\"}}},\"Action\":{\"description\":\"버튼을 눌렀을 때의 화면 간 동작 하나(#265). button에만 둔다. 생략하면 동작 없음이고 null은 무효다. 갈래는 type으로 가르며 통째로 교체한다(반응형 override 대상이 아니다). S1-1은 형태 저장만 지원한다. target 존재·대상 kind 등 프로젝트 참조 검증은 후속 S1-2, 동작 코드 생성은 후속 S1-8/9 범위이며 아직 지원하지 않는다.\",\"oneOf\":[{\"$ref\":\"#/$defs/NavigateAction\"},{\"$ref\":\"#/$defs/OpenModalAction\"},{\"$ref\":\"#/$defs/CloseAction\"}]},\"NavigateAction\":{\"type\":\"object\",\"description\":\"다른 page로 이동할 의도를 저장한다. 라우터 없이 onNavigate(target) 콜백을 호출하는 코드 생성은 후속 S1-9에서 구현할 계약이며 현재 지원하지 않는다.\",\"additionalProperties\":false,\"required\":[\"type\",\"target\"],\"properties\":{\"type\":{\"const\":\"navigate\"},\"target\":{\"$ref\":\"#/$defs/PageId\"}}},\"OpenModalAction\":{\"type\":\"object\",\"description\":\"modal 화면을 열 의도를 저장한다. 한 번에 하나의 모달을 열고 교체하는 동작은 후속 S1-9에서 구현할 계약이며 현재 지원하지 않는다.\",\"additionalProperties\":false,\"required\":[\"type\",\"target\"],\"properties\":{\"type\":{\"const\":\"openModal\"},\"target\":{\"$ref\":\"#/$defs/PageId\"}}},\"CloseAction\":{\"type\":\"object\",\"description\":\"열린 모달을 닫을 의도를 저장한다. target은 받지 않는다. 닫기 동작 코드 생성은 후속 S1-9에서 구현할 계약이며 현재 지원하지 않는다.\",\"additionalProperties\":false,\"required\":[\"type\"],\"properties\":{\"type\":{\"const\":\"close\"}}},\"ChildReference\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"node\"],\"properties\":{\"node\":{\"$ref\":\"#/$defs/NodeId\"}}},\"Box\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"width\",\"height\"],\"properties\":{\"width\":{\"$ref\":\"#/$defs/Size\"},\"height\":{\"$ref\":\"#/$defs/Size\"}}},\"Color\":{\"type\":\"string\",\"description\":\"#RRGGBB 또는 #RRGGBBAA\",\"pattern\":\"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$\"},\"Padding\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"top\",\"right\",\"bottom\",\"left\"],\"properties\":{\"top\":{\"type\":\"number\",\"minimum\":0},\"right\":{\"type\":\"number\",\"minimum\":0},\"bottom\":{\"type\":\"number\",\"minimum\":0},\"left\":{\"type\":\"number\",\"minimum\":0}}},\"Layout\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"direction\",\"gap\",\"padding\",\"mainAxis\",\"crossAxis\"],\"properties\":{\"direction\":{\"type\":\"string\",\"enum\":[\"row\",\"column\",\"grid\"]},\"gap\":{\"type\":\"number\",\"minimum\":0},\"padding\":{\"$ref\":\"#/$defs/Padding\"},\"mainAxis\":{\"type\":\"string\",\"enum\":[\"start\",\"center\",\"end\",\"space-between\"]},\"crossAxis\":{\"type\":\"string\",\"enum\":[\"start\",\"center\",\"end\",\"stretch\"]},\"columns\":{\"type\":\"integer\",\"minimum\":1,\"description\":\"direction이 \\\"grid\\\"일 때만 의미가 있는 열 개수. 없으면 1열로 본다. row/column에 이 필드를 강제하면 기존 예제·테스트가 전부 깨지는데, grid에만 뜻이 있는 값을 매번 채우게 하는 것도 부자연스럽다. 선택 필드 추가 조건은 06-schema-freeze.md '변경 규칙' 참고.\"}}},\"Background\":{\"type\":\"array\",\"description\":\"채우기 겹 목록. 배열 앞이 위다(CSS background-image와 같은 순서). 생략과 빈 배열은 둘 다 '채우기 없음'이다. 배열이라 부분 병합하지 않고 통째로 교체한다(updateNode 경로는 \\\"background\\\" 하나).\",\"items\":{\"$ref\":\"#/$defs/Fill\"}},\"Fill\":{\"description\":\"채우기 겹 하나. 종류는 type으로 가른다. radial은 아직 없다 — 나중에 갈래를 더해도 기존 문서는 깨지지 않는다.\",\"oneOf\":[{\"$ref\":\"#/$defs/SolidFill\"},{\"$ref\":\"#/$defs/LinearFill\"},{\"$ref\":\"#/$defs/ImageFill\"}]},\"ImageFill\":{\"type\":\"object\",\"description\":\"이미지 배경. ImageNode와 같은 src 및 fit 계약. 중앙 정렬, 반복 없음. 기존 0.3 문서를 보존하는 추가 갈래다.\",\"additionalProperties\":false,\"required\":[\"type\",\"src\",\"fit\"],\"properties\":{\"type\":{\"const\":\"image\"},\"src\":{\"type\":\"string\",\"minLength\":1},\"fit\":{\"type\":\"string\",\"enum\":[\"cover\",\"contain\",\"fill\"]}}},\"SolidFill\":{\"type\":\"object\",\"description\":\"단색 채우기. 투명도는 color의 알파(#RRGGBBAA)로 쓴다.\",\"additionalProperties\":false,\"required\":[\"type\",\"color\"],\"properties\":{\"type\":{\"const\":\"solid\"},\"color\":{\"$ref\":\"#/$defs/Color\"}}},\"LinearFill\":{\"type\":\"object\",\"description\":\"선형 그라디언트 채우기. 의미는 CSS linear-gradient와 같다.\",\"additionalProperties\":false,\"required\":[\"type\",\"angle\",\"stops\"],\"properties\":{\"type\":{\"const\":\"linear\"},\"angle\":{\"type\":\"number\",\"minimum\":0,\"exclusiveMaximum\":360,\"description\":\"CSS linear-gradient의 각도(deg). 0 = 아래에서 위(to top), 90 = 왼쪽에서 오른쪽, 180 = 위에서 아래. 한 방향에 한 표기만 두려고 [0, 360)으로 막는다.\"},\"stops\":{\"type\":\"array\",\"minItems\":2,\"description\":\"색 정지점. at은 오름차순이어야 하고 같은 값은 허용한다(딱 끊기는 경계). JSON Schema로는 원소끼리 비교할 수 없어 validateVisualSpec·validateProjectSpec이 gradient-stop-order로 검사한다.\",\"items\":{\"$ref\":\"#/$defs/GradientStop\"}}}},\"GradientStop\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"color\",\"at\"],\"properties\":{\"color\":{\"$ref\":\"#/$defs/Color\"},\"at\":{\"type\":\"number\",\"minimum\":0,\"maximum\":1,\"description\":\"그라디언트 선 위의 위치. 0 = 시작, 1 = 끝. CSS로 옮길 때 at × 100%다.\"}}},\"Border\":{\"type\":\"object\",\"description\":\"MVP는 solid 고정, 네 모서리 균일\",\"additionalProperties\":false,\"required\":[\"width\",\"color\",\"radius\"],\"properties\":{\"width\":{\"type\":\"number\",\"minimum\":0},\"color\":{\"$ref\":\"#/$defs/Color\"},\"radius\":{\"$ref\":\"#/$defs/Radius\"},\"align\":{\"$ref\":\"#/$defs/StrokeAlign\"}}},\"Radius\":{\"description\":\"모서리 반경. 숫자 하나면 네 모서리가 같고, 객체면 모서리별로 다르다. 객체 쪽은 네 칸이 모두 필수다 — 한 칸만 쓴 반쪽 객체는 CSS border-radius를 통째로 깨뜨린다.\",\"oneOf\":[{\"type\":\"number\",\"minimum\":0},{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"topLeft\",\"topRight\",\"bottomRight\",\"bottomLeft\"],\"properties\":{\"topLeft\":{\"type\":\"number\",\"minimum\":0},\"topRight\":{\"type\":\"number\",\"minimum\":0},\"bottomRight\":{\"type\":\"number\",\"minimum\":0},\"bottomLeft\":{\"type\":\"number\",\"minimum\":0}}}]},\"StrokeAlign\":{\"type\":\"string\",\"description\":\"테두리를 박스 경계 기준 어디에 그릴지. 없으면 \\\"inside\\\"로 본다 — 지금까지 CSS border + box-sizing: border-box 로 그려온 방식이 곧 inside라, 기본값을 이렇게 두면 기존 문서의 렌더가 바뀌지 않는다.\",\"enum\":[\"inside\",\"center\",\"outside\"]},\"Shadow\":{\"type\":\"object\",\"description\":\"드롭 섀도 하나(Figma의 Drop shadow). CSS box-shadow 로 옮긴다. 텍스트에는 두지 않는다 — 글자 모양을 따라가는 그림자는 box-shadow가 아니라 filter: drop-shadow 라 성격이 다르다.\",\"additionalProperties\":false,\"required\":[\"x\",\"y\",\"blur\",\"spread\",\"color\"],\"properties\":{\"x\":{\"type\":\"number\",\"description\":\"가로 오프셋(px). 양수는 오른쪽.\"},\"y\":{\"type\":\"number\",\"description\":\"세로 오프셋(px). 양수는 아래.\"},\"blur\":{\"type\":\"number\",\"minimum\":0,\"description\":\"번짐 반경(px).\"},\"spread\":{\"type\":\"number\",\"description\":\"확장(px). 음수면 줄어든다.\"},\"color\":{\"$ref\":\"#/$defs/Color\"}}},\"Opacity\":{\"type\":\"number\",\"description\":\"0=완전 투명, 1=불투명. 자식까지 함께 투명해진다(CSS opacity와 같다).\",\"minimum\":0,\"maximum\":1},\"Blur\":{\"type\":\"number\",\"description\":\"레이어 블러 반경(px). 자기 자신과 자식이 함께 흐려진다(CSS filter: blur). 뒤 배경을 흐리는 backdrop-filter 는 다른 기능이라 여기 포함하지 않는다.\",\"minimum\":0},\"Typography\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"fontFamily\",\"fontSize\",\"fontWeight\",\"lineHeight\",\"letterSpacing\",\"textAlign\"],\"properties\":{\"fontFamily\":{\"type\":\"string\",\"minLength\":1},\"fontSize\":{\"type\":\"number\",\"exclusiveMinimum\":0},\"fontWeight\":{\"type\":\"integer\",\"minimum\":100,\"maximum\":900,\"multipleOf\":100},\"lineHeight\":{\"type\":\"number\",\"exclusiveMinimum\":0},\"letterSpacing\":{\"type\":\"number\"},\"textAlign\":{\"type\":\"string\",\"enum\":[\"left\",\"center\",\"right\"]}}},\"PartialBox\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"width\":{\"$ref\":\"#/$defs/Size\"},\"height\":{\"$ref\":\"#/$defs/Size\"}},\"description\":\"반응형 Box 부분값. 생략한 칸은 상속하며 합성 결과는 완전한 Box여야 한다.\"},\"PartialPadding\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"top\":{\"type\":\"number\",\"minimum\":0},\"right\":{\"type\":\"number\",\"minimum\":0},\"bottom\":{\"type\":\"number\",\"minimum\":0},\"left\":{\"type\":\"number\",\"minimum\":0}},\"description\":\"반응형 Padding 부분값. 생략한 칸은 상속하며 합성 결과는 완전한 Padding여야 한다.\"},\"PartialLayout\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"direction\":{\"type\":\"string\",\"enum\":[\"row\",\"column\",\"grid\"]},\"gap\":{\"type\":\"number\",\"minimum\":0},\"padding\":{\"$ref\":\"#/$defs/PartialPadding\"},\"mainAxis\":{\"type\":\"string\",\"enum\":[\"start\",\"center\",\"end\",\"space-between\"]},\"crossAxis\":{\"type\":\"string\",\"enum\":[\"start\",\"center\",\"end\",\"stretch\"]},\"columns\":{\"type\":\"integer\",\"minimum\":1,\"description\":\"direction이 \\\"grid\\\"일 때만 의미가 있는 열 개수. 없으면 1열로 본다. row/column에 이 필드를 강제하면 기존 예제·테스트가 전부 깨지는데, grid에만 뜻이 있는 값을 매번 채우게 하는 것도 부자연스럽다. 선택 필드 추가 조건은 06-schema-freeze.md '변경 규칙' 참고.\"}},\"description\":\"반응형 Layout 부분값. 생략한 칸은 상속하며 합성 결과는 완전한 Layout여야 한다.\"},\"PartialBorder\":{\"type\":\"object\",\"description\":\"반응형 Border 부분값. 생략한 칸은 상속하며 합성 결과는 완전한 Border여야 한다.\",\"additionalProperties\":false,\"properties\":{\"width\":{\"type\":\"number\",\"minimum\":0},\"color\":{\"$ref\":\"#/$defs/Color\"},\"radius\":{\"$ref\":\"#/$defs/PartialRadius\"},\"align\":{\"$ref\":\"#/$defs/StrokeAlign\"}}},\"PartialTypography\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"fontFamily\":{\"type\":\"string\",\"minLength\":1},\"fontSize\":{\"type\":\"number\",\"exclusiveMinimum\":0},\"fontWeight\":{\"type\":\"integer\",\"minimum\":100,\"maximum\":900,\"multipleOf\":100},\"lineHeight\":{\"type\":\"number\",\"exclusiveMinimum\":0},\"letterSpacing\":{\"type\":\"number\"},\"textAlign\":{\"type\":\"string\",\"enum\":[\"left\",\"center\",\"right\"]}},\"description\":\"반응형 Typography 부분값. 생략한 칸은 상속하며 합성 결과는 완전한 Typography여야 한다.\"},\"PartialRadius\":{\"description\":\"반응형 반경 부분값. 객체는 객체에서만 상속한다. 숫자에서 객체로 바꿀 때는 네 모서리가 필요하다.\",\"oneOf\":[{\"type\":\"number\",\"minimum\":0},{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"topLeft\":{\"type\":\"number\",\"minimum\":0},\"topRight\":{\"type\":\"number\",\"minimum\":0},\"bottomRight\":{\"type\":\"number\",\"minimum\":0},\"bottomLeft\":{\"type\":\"number\",\"minimum\":0}}}]},\"FrameOverride\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/PartialBox\"},\"layout\":{\"$ref\":\"#/$defs/PartialLayout\"},\"background\":{\"$ref\":\"#/$defs/Background\"},\"border\":{\"$ref\":\"#/$defs/PartialBorder\"},\"opacity\":{\"$ref\":\"#/$defs/Opacity\"},\"blur\":{\"$ref\":\"#/$defs/Blur\"}}},\"TextOverride\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/PartialBox\"},\"typography\":{\"$ref\":\"#/$defs/PartialTypography\"},\"color\":{\"$ref\":\"#/$defs/Color\"},\"opacity\":{\"$ref\":\"#/$defs/Opacity\"},\"blur\":{\"$ref\":\"#/$defs/Blur\"}}},\"ImageOverride\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/PartialBox\"},\"fit\":{\"type\":\"string\",\"description\":\"MVP는 object-fit 방식만.\",\"enum\":[\"cover\",\"contain\",\"fill\"]},\"opacity\":{\"$ref\":\"#/$defs/Opacity\"},\"blur\":{\"$ref\":\"#/$defs/Blur\"}}},\"ButtonOverride\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/PartialBox\"},\"typography\":{\"$ref\":\"#/$defs/PartialTypography\"},\"color\":{\"$ref\":\"#/$defs/Color\"},\"background\":{\"$ref\":\"#/$defs/Background\"},\"border\":{\"$ref\":\"#/$defs/PartialBorder\"}}},\"InputOverride\":{\"type\":\"object\",\"additionalProperties\":false,\"properties\":{\"visible\":{\"type\":\"boolean\",\"default\":true},\"box\":{\"$ref\":\"#/$defs/PartialBox\"},\"typography\":{\"$ref\":\"#/$defs/PartialTypography\"},\"color\":{\"$ref\":\"#/$defs/Color\"},\"background\":{\"$ref\":\"#/$defs/Background\"},\"border\":{\"$ref\":\"#/$defs/PartialBorder\"}}},\"NodeOverride\":{\"description\":\"대상 nodes[id].type에 해당하는 override만 허용한다(validator 의미 검증).\",\"anyOf\":[{\"$ref\":\"#/$defs/FrameOverride\"},{\"$ref\":\"#/$defs/TextOverride\"},{\"$ref\":\"#/$defs/ImageOverride\"},{\"$ref\":\"#/$defs/ButtonOverride\"},{\"$ref\":\"#/$defs/InputOverride\"}]},\"Breakpoint\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"minWidthPx\"],\"properties\":{\"minWidthPx\":{\"type\":\"number\",\"exclusiveMinimum\":0}},\"description\":\"양의 CSS px 경계. 같은 페이지의 다른 breakpoint와 폭이 달라야 한다.\"},\"Responsive\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"breakpoints\",\"overrides\"],\"properties\":{\"breakpoints\":{\"type\":\"object\",\"propertyNames\":{\"$ref\":\"#/$defs/NodeId\"},\"additionalProperties\":{\"$ref\":\"#/$defs/Breakpoint\"}},\"overrides\":{\"type\":\"object\",\"propertyNames\":{\"$ref\":\"#/$defs/NodeId\"},\"additionalProperties\":{\"type\":\"object\",\"propertyNames\":{\"$ref\":\"#/$defs/NodeId\"},\"additionalProperties\":{\"$ref\":\"#/$defs/NodeOverride\"}}}},\"description\":\"페이지별 breakpoint 및 노드별 희소 표현값. 빈 맵은 변경 없음. 객체는 재귀 병합, 배열은 전체 교체. 기본값은 기존 nodes이고 null 삭제 연산은 없다.\"}}")
};
//#endregion
//#region src/features/editor/schema/validateResponsive.ts
var validators = /* @__PURE__ */ new Map();
function validator(name) {
	let result = validators.get(name);
	if (!result) {
		const ajv = new Ajv2020({ allErrors: true });
		ajv.addSchema(visual_spec_schema_default, "visual-spec");
		result = ajv.compile({ $ref: `visual-spec#/$defs/${name}` });
		validators.set(name, result);
	}
	return result;
}
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** 객체만 재귀 병합한다. 배열·수는 교체하고 입력과 prototype은 변경하지 않는다. */
function merge(base, patch) {
	if (!record(patch)) return patch;
	const entries = new Map(Object.entries(record(base) ? base : {}));
	for (const [key, value] of Object.entries(patch)) entries.set(key, merge(entries.get(key), value));
	return Object.fromEntries(entries);
}
function pointer(value) {
	return value.replace(/~/g, "~0").replace(/\//g, "~1");
}
/** 스키마 통과 뒤 호출한다. GUI에서 렌더하는 함수가 아니라 폭별 계약 검증이다. */
function validateResponsive(screen, basePath) {
	const responsive = screen.responsive;
	if (!responsive) return [];
	const issues = [];
	const path = `${basePath}/responsive`;
	const breakpoints = new Map(Object.entries(responsive.breakpoints));
	const widths = /* @__PURE__ */ new Set();
	for (const [id, breakpoint] of breakpoints) {
		if (widths.has(breakpoint.minWidthPx)) issues.push({
			code: "responsive-duplicate-width",
			path: `${path}/breakpoints/${pointer(id)}/minWidthPx`,
			message: "같은 페이지의 breakpoint 폭은 서로 달라야 합니다."
		});
		widths.add(breakpoint.minWidthPx);
	}
	for (const id of Object.keys(responsive.overrides)) if (!breakpoints.has(id)) issues.push({
		code: "responsive-breakpoint-missing",
		path: `${path}/overrides/${pointer(id)}`,
		message: `breakpoint "${id}"가 선언되지 않았습니다.`
	});
	const effective = new Map(Object.entries(screen.nodes));
	for (const [id] of [...breakpoints].sort((a, b) => a[1].minWidthPx - b[1].minWidthPx)) {
		const overrides = Object.prototype.hasOwnProperty.call(responsive.overrides, id) ? responsive.overrides[id] : {};
		for (const [nodeId, patch] of Object.entries(overrides)) {
			const patchPath = `${path}/overrides/${pointer(id)}/${pointer(nodeId)}`;
			if (!Object.prototype.hasOwnProperty.call(screen.nodes, nodeId)) {
				issues.push({
					code: "responsive-node-missing",
					path: patchPath,
					message: `노드 "${nodeId}"가 없습니다.`
				});
				continue;
			}
			const type = screen.nodes[nodeId].type;
			const name = `${type[0].toUpperCase()}${type.slice(1)}`;
			if (!validator(`${name}Override`)(patch)) {
				issues.push({
					code: "responsive-node-property",
					path: patchPath,
					message: `${type} 노드에서 허용하지 않는 override 속성입니다.`
				});
				continue;
			}
			const merged = merge(effective.get(nodeId), patch);
			effective.set(nodeId, merged);
			const validateNode = validator(`${name}Node`);
			if (!validateNode(merged)) for (const error of validateNode.errors ?? []) issues.push({
				code: "responsive-effective-node",
				path: `${patchPath}${error.instancePath}`,
				message: `상속·병합 후 노드가 무효입니다: ${error.message ?? error.keyword}`
			});
			if ("background" in patch && patch.background) patch.background.forEach((fill, fillIndex) => {
				if (fill.type !== "linear") return;
				fill.stops.forEach((stop, index) => {
					if (index > 0 && stop.at < fill.stops[index - 1].at) issues.push({
						code: "gradient-stop-order",
						path: `${patchPath}/background/${fillIndex}/stops/${index}/at`,
						message: "그라디언트 stop의 위치(at)는 오름차순이어야 합니다."
					});
				});
			});
		}
	}
	return issues;
}
//#endregion
//#region src/features/editor/schema/validate.ts
var schemaValidator;
var projectSchemaValidator;
function getSchemaValidator() {
	if (schemaValidator === void 0) schemaValidator = new Ajv2020({ allErrors: true }).compile(visual_spec_schema_default);
	return schemaValidator;
}
/**
* ProjectSpec은 정본 스키마의 루트가 아니라 `$defs` 항목이다. 루트는 단일 화면
* VisualSpec으로 그대로 두기 위해서다. 그래서 스키마를 통째로 등록한 뒤
* 해당 `$def`를 가리키는 얇은 스키마를 컴파일한다.
*/
function getProjectSchemaValidator() {
	if (projectSchemaValidator === void 0) {
		const ajv = new Ajv2020({ allErrors: true });
		ajv.addSchema(visual_spec_schema_default, "visual-spec");
		projectSchemaValidator = ajv.compile({ $ref: "visual-spec#/$defs/ProjectSpec" });
	}
	return projectSchemaValidator;
}
function escapeJsonPointer(value) {
	return value.replace(/~/g, "~0").replace(/\//g, "~1");
}
function nodePath(basePath, nodeId) {
	return `${basePath}/nodes/${escapeJsonPointer(nodeId)}`;
}
function isFrameNode(node) {
	return node.type === "frame";
}
function describeSchemaError(error) {
	const params = error.params;
	switch (error.keyword) {
		case "required": return `필수 필드 "${params.missingProperty}"가 없습니다.`;
		case "additionalProperties": return `허용되지 않는 필드 "${params.additionalProperty}"가 있습니다.`;
		case "const": return `값이 ${JSON.stringify(params.allowedValue)}이어야 합니다.`;
		case "enum": return `값이 ${JSON.stringify(params.allowedValues)} 중 하나여야 합니다.`;
		case "type": return `값의 타입이 "${params.type}"이어야 합니다.`;
		case "pattern": return `값이 패턴 ${JSON.stringify(params.pattern)}과 일치하지 않습니다.`;
		case "propertyNames": return `속성 이름 "${params.propertyName}"이 허용되지 않는 형식입니다.`;
		case "minimum":
		case "exclusiveMinimum":
		case "maximum":
		case "exclusiveMaximum": return `값이 허용 범위를 벗어났습니다 (${error.keyword}: ${params.limit}).`;
		case "minLength": return `문자열이 너무 짧습니다 (최소 길이: ${params.limit}).`;
		case "minProperties": return `속성 개수가 너무 적습니다 (최소: ${params.limit}).`;
		case "multipleOf": return `값이 ${params.multipleOf}의 배수여야 합니다.`;
		case "oneOf": return "정의된 대안 스키마 중 어느 것과도 일치하지 않습니다. 같은 위치에 있는 다른 이슈가 실제 원인인 경우가 많습니다.";
		default: return `JSON 스키마 규칙(${error.keyword})을 위반했습니다.`;
	}
}
function validateScreenReferences(screen, basePath) {
	const issues = [];
	const { nodes, root } = screen;
	const hasNode = (nodeId) => Object.prototype.hasOwnProperty.call(nodes, nodeId);
	const rootNode = hasNode(root) ? nodes[root] : void 0;
	if (rootNode === void 0) issues.push({
		code: "root-missing",
		path: `${basePath}/root`,
		message: `루트 노드 "${root}"가 nodes에 없습니다.`
	});
	else if (!isFrameNode(rootNode)) issues.push({
		code: "root-not-frame",
		path: `${basePath}/root`,
		message: `루트 노드 "${root}"의 type은 "frame"이어야 합니다.`
	});
	const referencedAt = /* @__PURE__ */ new Map();
	for (const [parentId, node] of Object.entries(nodes)) {
		if (!isFrameNode(node)) continue;
		for (let index = 0; index < node.children.length; index += 1) {
			const child = node.children[index];
			const path = `${nodePath(basePath, parentId)}/children/${index}/node`;
			const childId = child.node;
			if (!hasNode(childId)) issues.push({
				code: "child-missing",
				path,
				message: `자식 노드 "${childId}"가 nodes에 없습니다.`
			});
			if (hasNode(childId)) {
				const firstReferencePath = referencedAt.get(childId);
				if (firstReferencePath === void 0) referencedAt.set(childId, path);
				else if (firstReferencePath !== path) issues.push({
					code: "multiple-parents",
					path,
					message: `노드 "${childId}"가 두 곳 이상에서 참조되었습니다.`
				});
			}
		}
	}
	const visited = /* @__PURE__ */ new Set();
	const visiting = /* @__PURE__ */ new Set();
	let hasCycle = false;
	const visit = (nodeId) => {
		if (visited.has(nodeId)) return;
		visiting.add(nodeId);
		const node = hasNode(nodeId) ? nodes[nodeId] : void 0;
		if (node !== void 0 && isFrameNode(node)) for (let index = 0; index < node.children.length; index += 1) {
			const childId = node.children[index].node;
			if (!hasNode(childId)) continue;
			if (visiting.has(childId)) {
				hasCycle = true;
				issues.push({
					code: "cycle",
					path: `${nodePath(basePath, nodeId)}/children/${index}/node`,
					message: `노드 "${childId}"로 향하는 자식 참조에서 순환이 발견되었습니다.`
				});
				continue;
			}
			visit(childId);
		}
		visiting.delete(nodeId);
		visited.add(nodeId);
	};
	for (const nodeId of Object.keys(nodes)) visit(nodeId);
	if (!hasCycle && !(rootNode === void 0)) {
		const reachable = /* @__PURE__ */ new Set();
		const pending = [root];
		while (pending.length > 0) {
			const nodeId = pending.pop();
			if (nodeId === void 0 || reachable.has(nodeId)) continue;
			reachable.add(nodeId);
			const node = hasNode(nodeId) ? nodes[nodeId] : void 0;
			if (node !== void 0 && isFrameNode(node)) {
				for (const child of node.children) if (hasNode(child.node) && !reachable.has(child.node)) pending.push(child.node);
			}
		}
		for (const nodeId of Object.keys(nodes)) if (!reachable.has(nodeId)) issues.push({
			code: "orphan-node",
			path: nodePath(basePath, nodeId),
			message: `노드 "${nodeId}"는 루트에서 도달할 수 없습니다.`
		});
	}
	return issues;
}
/**
* 그라디언트 stop의 `at`이 오름차순인지 본다(같은 값은 허용 — 딱 끊기는 경계).
*
* JSON Schema 2020-12에는 배열 원소끼리 비교하는 문법이 없어 여기서 따로 본다.
* 렌더에서 정렬해 주지 않고 무효로 두는 이유는 CSS가 앞보다 작은 stop을 정렬하지
* 않고 앞 값으로 끌어올리기 때문이다 — 순서가 틀린 JSON의 뜻이 번역기마다
* 달라진다(docs/13-background-fill-design.md "표현 규칙").
*
* 스키마를 통과한 뒤에만 부르므로 `background`의 모양은 이미 맞다.
*/
function validateGradientStops(screen, basePath) {
	const issues = [];
	for (const [nodeId, node] of Object.entries(screen.nodes)) {
		const background = "background" in node ? node.background : void 0;
		if (background === void 0) continue;
		background.forEach((fill, fillIndex) => {
			if (fill.type !== "linear") return;
			for (let index = 1; index < fill.stops.length; index += 1) {
				const previous = fill.stops[index - 1].at;
				const current = fill.stops[index].at;
				if (current < previous) issues.push({
					code: "gradient-stop-order",
					path: `${nodePath(basePath, nodeId)}/background/${fillIndex}/stops/${index}/at`,
					message: `그라디언트 stop의 위치(at)는 오름차순이어야 합니다 — ${current}가 앞 stop의 ${previous}보다 작습니다.`
				});
			}
		});
	}
	return issues;
}
function validateVisualSpec(input) {
	try {
		const validateSchema = getSchemaValidator();
		if (!validateSchema(input)) {
			const issues = (validateSchema.errors ?? []).map((error) => ({
				code: "schema",
				path: error.instancePath || "/",
				message: describeSchemaError(error)
			}));
			if (issues.length === 0) issues.push({
				code: "schema",
				path: "/",
				message: "스키마 검증에 실패했습니다."
			});
			return {
				valid: false,
				issues
			};
		}
		const { screen } = input;
		const issues = [
			...validateScreenReferences(screen, "/screen"),
			...validateGradientStops(screen, "/screen"),
			...validateResponsive(screen, "/screen")
		];
		return {
			valid: issues.length === 0,
			issues
		};
	} catch {
		return {
			valid: false,
			issues: [{
				code: "schema",
				path: "/",
				message: "입력을 검증하는 중 오류가 발생했습니다."
			}]
		};
	}
}
/**
* `pageOrder`가 `pages`의 키와 정확히 일치하는지 본다.
*
* 이 불변조건은 JSON Schema 2020-12로 표현할 수 없다 — 배열 항목이 객체 키를
* 참조하는 문법이 없기 때문이다. `nodes` ↔ `children.node`를 그래프 검사로
* 처리하는 것과 같은 이유로 여기서 따로 확인한다.
* (`pageOrder` 자체의 중복은 스키마의 `uniqueItems`가 잡는다.)
*/
function validatePageOrder(project) {
	const issues = [];
	const ordered = new Set(project.pageOrder);
	for (let index = 0; index < project.pageOrder.length; index += 1) {
		const pageId = project.pageOrder[index];
		if (!Object.prototype.hasOwnProperty.call(project.pages, pageId)) issues.push({
			code: "page-order-mismatch",
			path: `/pageOrder/${index}`,
			message: `pageOrder의 "${pageId}"가 pages에 없습니다.`
		});
	}
	for (const pageId of Object.keys(project.pages)) if (!ordered.has(pageId)) issues.push({
		code: "page-order-mismatch",
		path: `/pages/${escapeJsonPointer(pageId)}`,
		message: `페이지 "${pageId}"가 pageOrder에 없습니다.`
	});
	return issues;
}
/**
* 프로젝트 문서를 검증한다. 절대 던지지 않는다.
* 페이지마다 화면 문서와 같은 그래프·stop 정렬 검사를 돌리고, 에러 경로는
* `/pages/<id>/...`가 된다.
*
* 0.1·0.2 문서는 여기서 무효다 — 옛 문서를 받는 입구는 `migrateToV03`로 먼저
* 바꾼 뒤 검증한다(store/loadSpec.ts·store/specStorage.ts).
*/
function validateProjectSpec(input) {
	try {
		const validateSchema = getProjectSchemaValidator();
		if (!validateSchema(input)) {
			const issues = (validateSchema.errors ?? []).map((error) => ({
				code: "schema",
				path: error.instancePath || "/",
				message: describeSchemaError(error)
			}));
			if (issues.length === 0) issues.push({
				code: "schema",
				path: "/",
				message: "스키마 검증에 실패했습니다."
			});
			return {
				valid: false,
				issues
			};
		}
		const project = input;
		const issues = validatePageOrder(project);
		for (const [pageId, page] of Object.entries(project.pages)) {
			const pagePath = `/pages/${escapeJsonPointer(pageId)}`;
			issues.push(...validateScreenReferences(page, pagePath), ...validateGradientStops(page, pagePath), ...validateResponsive(page, pagePath));
		}
		return {
			valid: issues.length === 0,
			issues
		};
	} catch {
		return {
			valid: false,
			issues: [{
				code: "schema",
				path: "/",
				message: "입력을 검증하는 중 오류가 발생했습니다."
			}]
		};
	}
}
function assertVisualSpec(input) {
	const result = validateVisualSpec(input);
	if (!result.valid) throw new VisualSpecValidationError(result.issues);
}
var VisualSpecValidationError = class extends Error {
	issues;
	constructor(issues) {
		super("Visual Spec 검증에 실패했습니다.");
		this.name = "VisualSpecValidationError";
		this.issues = issues;
	}
};
//#endregion
//#region src/features/editor/schema/migrate.ts
/**
* 화면 문서를 넓힐 때 쓰는 페이지 id.
* `screen.name`을 그대로 쓰지 않는 이유는 이름에 공백이나 한글이 들어갈 수 있는데
* 페이지 id는 `^[A-Za-z0-9_-]+$`만 허용하기 때문이다.
*/
var FIRST_PAGE_ID = "page1";
/**
* 화면 문서(`VisualSpec`)를 페이지 1개짜리 프로젝트로 넓힌다.
*
* 이름은 v0.1 시절 그대로지만(공개 API라 유지한다) 입출력은 둘 다 0.3이다 —
* 0.1 파일은 입구(store/loadSpec.ts)에서 `migrateToV03`를 먼저 거친 뒤 여기 온다.
* 버리는 정보가 없다. `toVisualSpec`으로 되돌리면 원본과 같아진다.
*/
function migrateV01(spec) {
	return {
		version: "0.3",
		name: spec.screen.name,
		pages: { [FIRST_PAGE_ID]: spec.screen },
		pageOrder: [FIRST_PAGE_ID]
	};
}
/**
* 페이지 하나를 화면 문서 모양으로 되돌린다.
* Export "이 페이지만 내보내기"가 화면 문서 계약대로 떨어지게 한다. 버전은 0.3이다.
*/
function toVisualSpec(page) {
	return {
		version: "0.3",
		screen: page
	};
}
/**
* 0.1(화면)·0.2(프로젝트) 문서를 0.3으로 바꾼다(#127). 바깥에서 들어온 문서를
* 검증하기 **전에** 부른다 — 변환 → 새 validator 순서다.
*
* 0.3이 바꾼 것은 `background` 모양 하나다. `{ color: c }`를
* `[{ type: "solid", color: c }]`로 바꾸고 `version`을 "0.3"으로 올린다. 버리는
* 정보가 없고 렌더 결과도 같다(docs/13-background-fill-design.md "마이그레이션과 버전").
*
* 입력이 `unknown`인 이유는 스키마가 바뀐 뒤에는 옛 모양의 생성 타입이 없기
* 때문이다. 그래서 **아는 모양만 건드리고 나머지는 그대로 둔다** — 결과를 검증기가
* 보고하게 하려는 것이다.
* - 버전과 키가 짝이 맞는 문서만 바꾼다 — "0.1"이면 `screen`, "0.2"면 `pages`.
*   짝이 안 맞는 문서는 옛 스키마로도 무효였으니 버전을 올려 유효하게 만들지 않는다.
* - 이미 0.3이거나 버전이 다른 문서는 그대로 돌려준다. 0.3 문서에 남은
*   `{ color }`는 고쳐 주지 않는다 — 새 모양으로 쓴다고 한 문서의 오류다.
* - `background`는 "문자열 `color` 하나만 가진 객체"일 때만 바꾼다. 그 밖의 값
*   (색이 숫자, 다른 칸이 섞임, 이미 배열 등)은 그대로 둔다.
*
* 입력을 고치지 않는다. 바뀌는 길만 얕게 복사한다.
*/
function migrateToV03(input) {
	if (!isRecord(input)) return input;
	if (input.version === "0.1" && "screen" in input) return {
		...input,
		version: "0.3",
		screen: migrateScreen(input.screen)
	};
	if (input.version === "0.2" && "pages" in input) {
		const { pages } = input;
		return {
			...input,
			version: "0.3",
			pages: isRecord(pages) ? mapValues(pages, migrateScreen) : pages
		};
	}
	return input;
}
function migrateScreen(screen) {
	if (!isRecord(screen) || !isRecord(screen.nodes)) return screen;
	return {
		...screen,
		nodes: mapValues(screen.nodes, migrateNode)
	};
}
function migrateNode(node) {
	if (!isRecord(node) || !("background" in node)) return node;
	const { background } = node;
	if (!isLegacyBackground(background)) return node;
	return {
		...node,
		background: [{
			type: "solid",
			color: background.color
		}]
	};
}
/** 0.1·0.2의 `Background` — 문자열 `color` 칸 하나뿐인 객체. */
function isLegacyBackground(value) {
	return isRecord(value) && Object.keys(value).length === 1 && typeof value.color === "string";
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function mapValues(record, map) {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)]));
}
//#endregion
export { VisualSpecValidationError, assertVisualSpec, migrateToV03, migrateV01, toVisualSpec, validateProjectSpec, validateVisualSpec, visual_spec_schema_default as visualSpecJsonSchema };
