
document.addEventListener("DOMContentLoaded", () => {
    const departmentSelect = document.getElementById("departmentSelect");
    const chatForm = document.getElementById("chatForm");
    const questionInput = document.getElementById("questionInput");
    const sendButton = document.getElementById("sendButton");
    const composerHint = document.getElementById("composerHint");

    const chatArea = document.getElementById("chatArea");
    const welcomeScreen = document.getElementById("welcomeScreen");
    const messages = document.getElementById("messages");

    const newChatButton = document.getElementById("newChatButton");
    const suggestionCards = document.querySelectorAll(".suggestion-card");
    const conversationList = document.getElementById("conversationList");

    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("menuButton");
    const closeSidebar = document.getElementById("closeSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    const departmentNames = {
        data1: "성서학과",
        data2: "사회복지학과",
        data3: "영유아보육학과",
        data4: "간호학과",
        data5: "AI융합학부"
    };

    let currentConversationId = null;
    let isLoading = false;

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, options);

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error || "서버 요청에 실패했습니다."
            );
        }

        return result;
    }

    function updateInputState() {
        const department = departmentSelect.value;
        const hasQuestion = questionInput.value.trim() !== "";

        sendButton.disabled =
            isLoading || !department || !hasQuestion;

        if (isLoading) {
            composerHint.textContent = "답변을 생성하고 있습니다...";
        } else if (!department) {
            composerHint.textContent = "먼저 학과를 선택해 주세요.";
        } else {
            composerHint.textContent =
                `${departmentNames[department]} 선택됨`;
        }
    }

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function createMessage(role, text) {
        const message = document.createElement("div");
        message.className = `message ${role}`;

        if (role === "assistant") {
            const avatar = document.createElement("div");
            avatar.className = "message-avatar";
            avatar.textContent = "✳";

            const content = document.createElement("div");
            content.className = "message-content";

            const label = document.createElement("div");
            label.className = "message-label";
            label.textContent = "한국성서대 학사 안내 AI";

            const body = document.createElement("div");
            body.textContent = text;

            content.append(label, body);
            message.append(avatar, content);
        } else {
            const content = document.createElement("div");
            content.className = "message-content";
            content.textContent = text;
            message.append(content);
        }

        messages.appendChild(message);
        welcomeScreen.hidden = true;

        return message;
    }

    function showLoading() {
        const message = document.createElement("div");
        message.className = "message assistant";
        message.id = "loadingMessage";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "✳";

        const content = document.createElement("div");
        content.className = "message-content";

        const label = document.createElement("div");
        label.className = "message-label";
        label.textContent = "한국성서대 학사 안내 AI";

        const indicator = document.createElement("div");
        indicator.className = "loading-indicator";

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement("span");
            indicator.appendChild(dot);
        }

        content.append(label, indicator);
        message.append(avatar, content);
        messages.appendChild(message);

        scrollToBottom();
    }

    function hideLoading() {
        document.getElementById("loadingMessage")?.remove();
    }

    function closeMobileSidebar() {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("visible");
    }

    function openMobileSidebar() {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("visible");
    }

    // DB에 저장된 대화 목록을 사이드바에 표시한다.
    async function loadConversationList() {
        try {
            const result = await apiRequest("/api/conversations");

            conversationList.replaceChildren();

            if (result.conversations.length === 0) {
                const empty = document.createElement("p");
                empty.className = "history-empty";
                empty.textContent = "저장된 대화가 없습니다.";
                conversationList.appendChild(empty);
                return;
            }

            result.conversations.forEach((conversation) => {
                const item = document.createElement("div");
                item.className = "conversation-item";

                if (conversation.id === currentConversationId) {
                    item.classList.add("active");
                }

                const openButton = document.createElement("button");
                openButton.type = "button";
                openButton.className = "conversation-open";
                openButton.textContent = conversation.title || "새 채팅";
                openButton.title = conversation.title || "새 채팅";

                openButton.addEventListener("click", () => {
                    openConversation(conversation.id);
                });

                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "conversation-delete";
                deleteButton.textContent = "×";
                deleteButton.title = "대화 삭제";
                deleteButton.setAttribute("aria-label", "대화 삭제");

                deleteButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    deleteConversation(conversation.id);
                });

                item.append(openButton, deleteButton);
                conversationList.appendChild(item);
            });
        } catch (error) {
            console.error("대화 목록 조회 실패:", error);
            conversationList.replaceChildren();

            const errorMessage = document.createElement("p");
            errorMessage.className = "history-empty";
            errorMessage.textContent = "대화 목록을 불러오지 못했습니다.";

            conversationList.appendChild(errorMessage);
        }
    }

    // 서버에 새 대화를 생성한다.
    async function startNewConversation() {
        if (isLoading) return;

        try {
            const result = await apiRequest("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    department: departmentSelect.value
                })
            });

            currentConversationId = result.id;
            messages.replaceChildren();
            welcomeScreen.hidden = false;

            questionInput.value = "";
            questionInput.style.height = "auto";

            await loadConversationList();
            updateInputState();
            closeMobileSidebar();
            questionInput.focus();
        } catch (error) {
            alert(`새 채팅을 만들지 못했습니다: ${error.message}`);
        }
    }

    // 선택한 대화와 메시지를 DB에서 다시 불러온다.
    async function openConversation(conversationId) {
        if (isLoading) return;

        try {
            const result = await apiRequest(
                `/api/conversations/${conversationId}`
            );

            currentConversationId = result.conversation.id;

            departmentSelect.value =
                result.conversation.department || "";

            messages.replaceChildren();

            if (result.messages.length === 0) {
                welcomeScreen.hidden = false;
            } else {
                welcomeScreen.hidden = true;

                result.messages.forEach((message) => {
                    createMessage(message.role, message.content);
                });
            }

            questionInput.value = "";
            questionInput.style.height = "auto";

            await loadConversationList();
            updateInputState();
            closeMobileSidebar();
            scrollToBottom();
        } catch (error) {
            alert(`대화를 불러오지 못했습니다: ${error.message}`);
        }
    }

    // 대화와 그 안의 메시지를 DB에서 삭제한다.
    async function deleteConversation(conversationId) {
        if (isLoading) return;

        const confirmed = confirm(
            "이 대화를 삭제할까요? 삭제한 대화는 복구할 수 없습니다."
        );

        if (!confirmed) return;

        try {
            await apiRequest(`/api/conversations/${conversationId}`, {
                method: "DELETE"
            });

            if (currentConversationId === conversationId) {
                currentConversationId = null;
                messages.replaceChildren();
                welcomeScreen.hidden = false;
                questionInput.value = "";
            }

            await loadConversationList();
            updateInputState();
        } catch (error) {
            alert(`대화를 삭제하지 못했습니다: ${error.message}`);
        }
    }

    // 질문을 보내고 Gemini의 답변을 저장한다.
    async function sendQuestion(questionText) {
        const question = questionText.trim();
        const department = departmentSelect.value;

        if (!question || isLoading) return;

        if (!department) {
            composerHint.textContent =
                "질문하기 전에 학과를 선택해 주세요.";
            departmentSelect.focus();
            return;
        }

        // 대화가 없으면 먼저 새 대화를 생성한다.
        if (currentConversationId === null) {
            try {
                const result = await apiRequest("/api/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ department })
                });

                currentConversationId = result.id;
            } catch (error) {
                alert(`새 대화를 만들지 못했습니다: ${error.message}`);
                return;
            }
        }

        createMessage("user", question);

        questionInput.value = "";
        questionInput.style.height = "auto";

        isLoading = true;
        updateInputState();
        showLoading();

        try {
            const result = await apiRequest("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    department,
                    question,
                    conversation_id: currentConversationId
                })
            });

            currentConversationId = result.conversation_id;

            hideLoading();
            createMessage("assistant", result.answer);

            await loadConversationList();
        } catch (error) {
            hideLoading();

            const errorMessage = createMessage(
                "assistant",
                error.message || "서버에 연결할 수 없습니다."
            );

            errorMessage.classList.add("message-error");

            // 요청이 실패했더라도 대화 목록을 다시 확인한다.
            await loadConversationList();
        } finally {
            isLoading = false;
            updateInputState();
            questionInput.focus();
        }
    }

    questionInput.addEventListener("input", () => {
        questionInput.style.height = "auto";
        questionInput.style.height =
            `${Math.min(questionInput.scrollHeight, 180)}px`;

        updateInputState();
    });

    questionInput.addEventListener("keydown", (event) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {
            event.preventDefault();

            if (!sendButton.disabled) {
                chatForm.requestSubmit();
            }
        }
    });

    departmentSelect.addEventListener("change", updateInputState);

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        sendQuestion(questionInput.value);
    });

    suggestionCards.forEach((card) => {
        card.addEventListener("click", () => {
            if (!departmentSelect.value) {
                composerHint.textContent =
                    "먼저 왼쪽 메뉴에서 학과를 선택해 주세요.";
                departmentSelect.focus();
                return;
            }

            sendQuestion(card.dataset.question || "");
        });
    });

    newChatButton.addEventListener("click", startNewConversation);

    menuButton.addEventListener("click", openMobileSidebar);
    closeSidebar.addEventListener("click", closeMobileSidebar);
    sidebarOverlay.addEventListener("click", closeMobileSidebar);

    // 페이지를 열 때 기존 대화 목록을 자동으로 불러온다.
    updateInputState();
    loadConversationList();
});
