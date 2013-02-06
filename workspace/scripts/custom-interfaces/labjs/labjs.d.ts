interface LabJSStatic {
    setGlobalDefaults(defaults: Object);
    script(path: string);
	wait(callback: any);
}

declare var $LAB: LabJSStatic;