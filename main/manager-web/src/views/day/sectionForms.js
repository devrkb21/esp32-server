// Editable copies of settings sections for a Day panel (the legacy forms/baseline rule):
// refreshed from the server only while unchanged; saved as the section's partial patch.
import { isDirty, sectionPatch, sectionProblem, serverForm } from './dayModel';

export default function sectionForms(sections, area) {
  return {
    inject: ['day'],
    data() {
      const forms = {};
      const baseline = {};
      for (const s of sections) {
        forms[s] = serverForm(this.day.view, s);
        baseline[s] = JSON.stringify(forms[s]);
      }
      return { forms, baseline };
    },
    watch: {
      'day.view'() { this.syncForms(false); },
    },
    methods: {
      // Replace the copies with the server values, except sections with unsaved edits
      // (unless force: after saving or undoing that section).
      syncForms(force, only) {
        for (const s of sections) {
          if (only && s !== only) continue;
          if (force || !this.isDirty(s)) {
            const value = serverForm(this.day.view, s);
            this.forms[s] = value;
            this.baseline[s] = JSON.stringify(value);
          }
        }
      },
      isDirty(s) { return isDirty(this.forms[s], this.baseline[s]); },
      revertSection(s) { this.syncForms(true, s); },
      problemText(s) {
        const p = sectionProblem(s, this.forms[s]);
        return p ? this.$t(p.key, this.day.nums(p.params)) : '';
      },
      saveSection(s, okText) {
        const problem = this.problemText(s);
        if (problem) { this.$message.warning(problem); return Promise.resolve(false); }
        return this.day.save(sectionPatch(s, this.forms[s]), typeof area === 'function' ? area(s) : (area || s), okText)
          .then(() => { this.syncForms(true, s); return true; })
          .catch(() => false);
      },
    },
  };
}
