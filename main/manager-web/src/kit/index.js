// The TinyBot kit: our own components, registered globally as Tb*, plus Element-compatible
// $message / $confirm / $prompt / $alert so older call sites keep working.
import TbIcon from './TbIcon.vue';
import TbButton from './TbButton.vue';
import TbField from './TbField.vue';
import TbInput from './TbInput.vue';
import TbTextarea from './TbTextarea.vue';
import TbSelect from './TbSelect.vue';
import TbSwitch from './TbSwitch.vue';
import TbCheckbox from './TbCheckbox.vue';
import TbChoice from './TbChoice.vue';
import TbSlider from './TbSlider.vue';
import TbTime from './TbTime.vue';
import TbTable from './TbTable.vue';
import TbPagination from './TbPagination.vue';
import TbSheet from './TbSheet.vue';
import TbTabs from './TbTabs.vue';
import TbTag from './TbTag.vue';
import TbSync from './TbSync.vue';
import TbEmpty from './TbEmpty.vue';
import TbLoading from './TbLoading.vue';
import TbMenu from './TbMenu.vue';
import TbUpload from './TbUpload.vue';
import TbPageHeader from './TbPageHeader.vue';
import TbSection from './TbSection.vue';
import TbFace from './TbFace.vue';
import TbDateBlock from './TbDateBlock.vue';
import TbMonthBand from './TbMonthBand.vue';
import TbNamePlate from './TbNamePlate.vue';
import TbDayTable from './TbDayTable.vue';
import TbToastHost from './TbToastHost.vue';
import TbConfirmHost from './TbConfirmHost.vue';
import TbMaker from './TbMaker.vue';
import TbRobotStatus from './TbRobotStatus.vue';
import { message, toast } from './toast';
import { alert, confirm, prompt } from './confirm';

export const components = {
  TbIcon, TbButton, TbField, TbInput, TbTextarea, TbSelect, TbSwitch, TbCheckbox, TbChoice, TbSlider, TbTime,
  TbTable, TbPagination, TbSheet, TbTabs, TbTag, TbSync, TbEmpty, TbLoading, TbMenu, TbUpload, TbPageHeader,
  TbSection, TbFace, TbDateBlock, TbMonthBand, TbNamePlate, TbDayTable, TbToastHost, TbConfirmHost, TbMaker,
  TbRobotStatus,
};

export { toast, confirm, prompt, alert };

export default {
  install(app) {
    for (const [name, c] of Object.entries(components)) app.component(name, c);
    app.config.globalProperties.$message = message;
    app.config.globalProperties.$toast = toast;
    app.config.globalProperties.$confirm = confirm;
    app.config.globalProperties.$prompt = prompt;
    app.config.globalProperties.$alert = alert;
  },
};
