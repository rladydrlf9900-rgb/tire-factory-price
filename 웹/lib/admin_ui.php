<?php /* 관리자 화면 — 로고 마크를 누르고 비밀번호를 맞춰야 열린다 */ ?>
<div id="view-admin" hidden>
  <header class="top">
    <div class="top-in">
      <span class="logo"><span class="mk"></span><span class="txt">타이어<b>공장도가격</b> <span style="font-size:11px;font-weight:800;color:var(--ink-3);letter-spacing:.08em">ADMIN</span></span></span>
      <span style="flex:1"></span>
      <div class="top-right">
        <button class="btn btn-out btn-sm" id="btn-pw">비밀번호 변경</button>
        <button class="btn btn-out btn-sm" id="btn-logout">나가기</button>
      </div>
    </div>
  </header>

  <div class="adm">
    <div class="admhead"><h2>제조사별 가격표 올리기</h2></div>

    <div class="bgrid" id="bgrid"></div>

    <div class="twocol">
      <div class="card keep">
        <div class="card-h">
          <div><h3>파일보관함</h3><p>제조사마다 <b>지금 사이트에 적용 중인</b> 파일입니다.</p></div>
          <span class="sp"></span><span class="tag ok">현재</span>
        </div>
        <div style="overflow-x:auto">
          <table class="mini">
            <thead><tr><th style="width:74px">제조사</th><th>파일명</th><th style="width:104px">적용 날짜</th><th class="t-r" style="width:56px">건수</th><th class="t-c" style="width:62px">받기</th></tr></thead>
            <tbody id="frows"></tbody>
          </table>
        </div>
      </div>

      <div class="card hist">
        <div class="card-h">
          <div><h3>최근 올린 파일</h3><p>최근 <b>30개</b>까지 남습니다. 되돌리면 이전 가격표로 돌아갑니다.</p></div>
          <span class="sp"></span><span class="tag">기록</span>
        </div>
        <div style="overflow-x:auto">
          <table class="mini">
            <thead><tr><th style="width:104px">올린 날짜</th><th style="width:74px">제조사</th><th>파일명</th><th class="t-c" style="width:142px">관리</th></tr></thead>
            <tbody id="hrows"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="veil" id="lockveil" hidden>
  <div class="lock">
    <h3>관리자 비밀번호</h3>
    <p>가격표를 올리려면 비밀번호를 입력하세요.</p>
    <input class="inp num" id="lockpw" type="password" inputmode="numeric" maxlength="30" placeholder="••••">
    <p class="err" id="lockerr" hidden></p>
    <div class="row">
      <button class="btn btn-out" id="lockno">취소</button>
      <button class="btn btn-pri" id="lockok">들어가기</button>
    </div>
  </div>
</div>

<div class="veil" id="resveil" hidden>
  <div class="lock" style="max-width:440px">
    <h3 id="resttl">업로드 완료</h3>
    <div id="resbody" style="font-size:13.5px; color:var(--ink-2); line-height:1.7; max-height:50vh; overflow:auto"></div>
    <div class="row"><button class="btn btn-pri" id="resok">확인</button></div>
  </div>
</div>
