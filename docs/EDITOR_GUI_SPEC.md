# Editor GUI Spec

이 문서는 최종 에디터 GUI의 예상 구조와 기능을 설명한다.

이번 스키마 구현 작업에서는 GUI 자체를 구현하지 않는다.
다만 향후 GUI에서 어떤 데이터를 생성하고 수정할지 판단하기 위한
참고 자료로 사용한다.

특히 스키마 설계 시 다음 영역을 참고한다.

- 캔버스의 화면 및 노드 계층
- 레이어 트리의 부모-자식 구조
- 세부설정 패널의 Layout, Background, Font, Border 항목
- Frame 및 Text 도구

File, View, Help, Export, Version History 등은
에디터 기능이며 화면 데이터 스키마와 직접 연결하지 않는다.
