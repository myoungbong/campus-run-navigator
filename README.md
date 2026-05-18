# Campus Run Navigator

GNSS 로그 기반 충북대학교 러닝 경로 시각화 웹 프로토타입입니다.

## 주요 기능

- 네이버 지도 API 기반 캠퍼스 지도 표시
- ZED-F9P로 수집한 `gnss_log_2.csv` 실측 경로 표시
- 실측 경로 위 지점을 노드로 선택
- 첫 노드부터 마지막 노드까지의 GNSS 로그 기반 거리 계산
- 러닝 페이스에 따른 예상 시간 계산

## 실행 방법

정적 웹사이트이므로 `index.html`을 브라우저에서 열거나, 로컬 서버로 실행하면 됩니다.

```bash
python -m http.server 4173
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173/
```

## 네이버 지도 API

네이버 클라우드 플랫폼에서 Maps Dynamic Map Client ID를 발급받아 웹페이지의 입력칸에 넣으면 됩니다.

GitHub Pages로 배포하는 경우, 네이버 클라우드 콘솔의 Web 서비스 URL에 배포 주소를 추가해야 합니다.

## 데이터

- `gnss_log_2.csv`: ZED-F9P 실측 GNSS 로그

CSV 형식:

```csv
PC_Time,UTC_Time,Latitude_NMEA,Lat_Direction,Longitude_NMEA,Lon_Direction,Fix,Satellites,Altitude_m
```
