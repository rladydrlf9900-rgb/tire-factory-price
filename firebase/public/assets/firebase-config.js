/* 이 사이트가 쓰는 파이어베이스 프로젝트 정보.
   여기 적힌 값은 공개되어도 되는 값이다 — 누가 무엇을 읽고 쓸 수 있는지는
   firestore.rules 가 정한다. */
window.FB = {
  projectId: "tireprice-g",
  apiKey: "AIzaSyCUzIolps8vdTNLnBRWJMNpcjsDPGwU0YE",
  authDomain: "tireprice-g.firebaseapp.com",
  appId: "1:840173474830:web:5d93e9e01ed6d25285d85f"
};

/* Firestore 를 SDK 없이 주소로 직접 읽는다 — 손님 화면이 가벼워진다 */
window.FS = "https://firestore.googleapis.com/v1/projects/" + FB.projectId +
            "/databases/(default)/documents";
