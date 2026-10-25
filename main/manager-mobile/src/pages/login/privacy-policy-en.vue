<!-- Privacy Policy (owner: m-auth): the text is kept as it was; only the reading layout is new -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Privacy Policy"
  }
}
</route>

<script lang="ts" setup>
import { t } from '@/i18n'
</script>

<template>
  <view class="tb-wrap legal">
    <tb-page-header :title="t('mauth.privacyTitle')" back />
    <view class="legal__doc">
      <view class="legal__head">
        <text class="legal__title">
          Privacy Policy
        </text>
      </view>
      <view class="legal__head">
        <text class="legal__date">
          Last Updated: March 10, 2026
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__p">
          Introduction
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          Welcome to use the ESP Backend Service (hereinafter referred to as "the Service"). The operator of this Service is the actual deployer and administrator of the Service (hereinafter referred to as "Operator" or "we"). We fully understand the importance of your personal information and will do our best to protect your personal information security.
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          Please carefully read and fully understand all contents of this Privacy Policy before using the Service. Once you start using the Service, it signifies that you have read and agreed to this Privacy Policy.
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          This Privacy Policy applies to our collection, storage, use, sharing, and protection of your personal information when you use the Service through the Admin Console (management backend), API interfaces, and other means.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          I. Information We Collect
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          To provide services to you, we may need to collect the following information:
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.1 Account Registration Information: When you register an account, we collect your phone number or username, password, and other information to create and verify your account.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.2 Device Information: When you bind hardware devices, we collect device identification information (such as device code, MAC address), device model, firmware version, etc., for device management and service provision.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.3 Agent Configuration Information: When you create and configure Agents, we collect role templates, language model selections, voice parameter configurations, etc., to provide personalized AI interaction services.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.4 Voice Interaction Data: When you use the voice interaction function, the Service uses Voice Activity Detection (VAD) to determine the start and end of your voice, processes your voice input data, and transmits it to third-party Automatic Speech Recognition (ASR) and Large Language Model (LLM) services for processing to achieve voice interaction capabilities.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.5 Image Data: When you use the vision model function, we may process image data captured through the device camera and transmit it to third-party vision model services for analysis and understanding to achieve image recognition, scene understanding, and other functions.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.6 Conversation Memory Data: When you enable the memory function, the Service stores summaries of your interaction history with the Agent to provide more coherent and personalized interaction experiences in subsequent conversations.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.7 Knowledge Base Data: When you use the knowledge base function, we collect and store documents, texts, and other knowledge base content you upload for Agents to perform knowledge retrieval and Q&A during conversations.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.8 Voice Print Data: When you use the voice print recognition function, we collect and store your voice print characteristic samples for speaker identity verification and personalized services.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.9 Chat History Data: We store conversation history records between you and the Agents, including text conversation content, conversation time, interaction context, etc., to provide continuous conversation experience and history query functions.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.10 Conversation Audio Data: When you use the voice interaction function, we may store audio data of your interactions with the Agents to improve voice interaction quality and enable retrieval queries.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.11 Agent Configuration Data: When you configure Agents, we collect tags, plugin configurations, context provider settings, etc., to provide Agent customization services.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.12 Device Firmware Data: When you use the OTA upgrade function, we record device firmware version, upgrade history, etc., for device management and firmware traceability.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          1.13 Log Information: When you use the Service, we automatically collect service log information, including but not limited to access time, IP address, browser type, operation records, etc., for service operation and security assurance.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          1.14 Verification Code Information: When you use phone number login, we send verification codes via SMS service for identity verification.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          II. How We Use the Collected Information
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          The information we collect will be used for the following purposes:
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          (1) Providing, maintaining, and improving the Service, including core functions such as account management, device management, and Agent configuration.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          (2) Processing your voice interaction requests, using Voice Activity Detection (VAD) to identify voice input, calling third-party AI model services to complete speech recognition, intent recognition, semantic understanding, and speech synthesis.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          (3) Processing your image data, calling third-party vision model services to complete image recognition and scene understanding.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          (4) Storing and managing your conversation memory data to provide more coherent service experiences in subsequent interactions.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          (5) Storing and retrieving knowledge base content you upload so that Agents can provide more accurate knowledge Q&A during conversations.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          (6) Ensuring service security and stability, including identity verification, security protection, troubleshooting, etc.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          (7) Complying with applicable laws, regulations, and regulatory requirements.
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          We will not use your personal information for purposes unrelated to the above. If we need to use information for other purposes not stated in this Privacy Policy, we will obtain your consent in advance.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          III. Sharing and Disclosure of Information
        </text>
      </view>
      <view class="legal__para">
        <text class="legal__p">
          We will not sell your personal information to third parties. Only in the following circumstances may we share or disclose your information:
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          3.1 Third-party Service Calls: To achieve voice interaction, visual understanding, and other functions, your voice data, image data, and text content may be transmitted to third-party AI service providers for processing.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          3.2 Legal Requirements: According to applicable laws, regulations, legal procedures, or requirements from government authorities, we may need to disclose your personal information.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          3.3 Security Assurance: To protect the Operator, other users, or the public from damage, we may use or disclose personal information within a reasonably necessary scope.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          3.4 With Consent: We may share your personal information with third parties if we obtain your explicit consent.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          IV. Storage and Protection of Information
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          4.1 Storage Location: Your personal information will be stored on the server where the Operator deploys the Service, including but not limited to databases (MySQL/PostgreSQL) and cache services (Redis).
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          4.2 Storage Period: We will retain your personal information for the period necessary to provide you with services. After you cancel your account, we will delete or anonymize your personal information within a reasonable time.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          4.3 Security Measures: We take reasonable technical and management measures to protect the security of your personal information, including but not limited to data encryption, access control, security auditing, etc.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          4.4 Security Incident Handling: If a personal information security incident occurs, we will promptly inform you of the basic situation of the security incident, possible impacts, and measures taken or to be taken.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          4.5 Special Note for Open-source Projects: The Service is an open-source project with two operation modes:
        </text>
      </view>
      <view class="legal__item legal__item--2">
        <text class="legal__p">
          (1) Self-deployment: If you self-deploy the Service, the Operator is only the code provider, and actual data storage and processing are your responsibility.
        </text>
      </view>
      <view class="legal__item legal__item--2">
        <text class="legal__p">
          (2) Test Platform: If you use the test platform deployed by the Operator, your data will be managed and protected by the Operator.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          4.6 Cross-border Data Transfer: When providing intelligent interaction functions, the Service may need to call interfaces from third-party AI service providers outside mainland China.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          V. Your Rights
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          5.1 Query and Access: You can view and manage your personal information such as account information, device information, and Agent configuration through the Admin Console.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          5.2 Correction and Modification: When you find that your personal information is incorrect, you can correct it through the Admin Console or contact the Operator for assistance.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          5.3 Deletion: Under certain circumstances, you may request us to delete your personal information.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          5.4 Account Cancellation: You can cancel your account through the account settings in the Admin Console or contact the Operator for processing.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          5.5 Withdrawal of Consent: You may withdraw your consent granted to us at any time.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          VI. Protection of Minor Information
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          6.1 We attach great importance to the protection of minors' personal information. If you are a minor under 18 years of age, please use the Service under the guidance and consent of your guardian.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          6.2 If a guardian discovers that a minor has provided personal information to us without consent, please contact the Operator. We will delete the relevant information as soon as possible.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          6.3 For minors who use the Service with guardian consent, we will provide stricter protection for their personal information in accordance with laws and regulations.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          VII. Third-party Services Description
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          7.1 When providing intelligent interaction functions, the Service needs to call third-party services, including but not limited to: Voice Activity Detection Service (VAD), Automatic Speech Recognition Service (ASR), Large Language Model Service (LLM), Text-to-Speech Service (TTS), Vision Model Service, SMS Verification Code Service, MQTT Message Broker Service, Database Service.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          7.2 The above third-party service providers will process data according to their respective privacy policies. We recommend that you understand the privacy policies of relevant third-party service providers before using the Service.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          VIII. Use of Cookies and Similar Technologies
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          8.1 The Service may use Cookies and similar technologies to save your login status, record your preference settings, etc., to provide you with a better user experience.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          8.2 You can manage Cookies through browser settings. However, please note that disabling Cookies may affect some functions of the Service.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          IX. Changes to the Privacy Policy
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          9.1 We may revise this Privacy Policy based on business adjustments, changes in laws and regulations, and other reasons. The revised Privacy Policy will be published through the Service's announcement mechanisms.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          9.2 If you continue to use the Service after the Privacy Policy revision, it shall be deemed that you have accepted the revised Privacy Policy.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          X. Information Security Warning
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          10.1 Please do not disclose sensitive personal information such as your property account numbers, bank card numbers, credit card numbers, passwords, ID card numbers, etc., in voice or text interactions with AI. Any losses resulting from this shall be borne by you.
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          10.2 Please properly keep your account and password secure, and do not share your account information with others or share accounts with others.
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          10.3 If you discover that personal information may have been leaked, please contact the Operator promptly to take measures.
        </text>
      </view>
      <view class="legal__h">
        <text class="legal__htext">
          XI. Applicable Law
        </text>
      </view>
      <view class="legal__item">
        <text class="legal__p">
          11.1 The formulation, interpretation, execution, and dispute resolution of this Privacy Policy shall be governed by the laws of the People's Republic of China (excluding the laws of Hong Kong, Macau, and Taiwan for the purposes of this Privacy Policy).
        </text>
      </view>
      <view class="legal__item is-last">
        <text class="legal__p">
          11.2 If any provision of this Privacy Policy conflicts with the current laws and regulations of the People's Republic of China, the provisions of laws and regulations shall prevail, and the remaining provisions shall remain valid.
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
/* The reading layout of the legal pages (same rules in all four) */
.legal {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.legal__doc {
  max-width: 65ch;
  margin: 0 auto;
  padding-top: 18px;
}
.legal__head {
  margin-bottom: 4px;
}
.legal__title {
  display: block;
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 20px;
  line-height: 1.25;
}
.legal__date {
  display: block;
  font-size: 13px;
  color: var(--tb-ink-2);
  margin-bottom: 8px;
}
.legal__h {
  margin: 26px 0 10px;
  padding-top: 12px;
  border-top: 1px solid var(--tb-rule);
}
.legal__h .legal__htext,
.legal__h .legal__p {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 17px;
  line-height: 1.35;
  color: var(--tb-ink);
}
.legal__htext {
  font-weight: 600;
}
.legal__p {
  font-size: 15px;
  line-height: 1.7;
  color: var(--tb-ink);
}
.legal__para {
  margin-bottom: 12px;
}
.legal__item {
  margin: 0 0 8px 10px;
}
.legal__item.is-last {
  margin-bottom: 18px;
}
.legal__item--2 {
  margin-left: 22px;
}
.legal__item--3 {
  margin-left: 34px;
}
</style>
