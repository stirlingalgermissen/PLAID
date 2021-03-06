/**
 * Copyright 2017 California Institute of Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @file Contains the core of the wizard controls. The primary function is
 * initWizard, which contains the settings object controlling the wizard. The other functions
 * control the dynamic creation of steps in the wizard from JSON data as well as controlling
 * the flow of the wizard.
 *
 * Creation Date: 6/16/16.
 *
 * @author Trevor Morse
 * @author Michael Kim
 * @author Stirling Algermissen
 */
const VALUE_DROPDOWN_LIST_NO_SELECTION = "No item selected";
const UNIT_DROPDOWN_LIST_NO_SELECTION = "No unit selected";
const UNIT_ATTRIBUTE_NAME = "unit";
const FOUND_ATTRIBUTE_NAME = "found";       // XML Node attribute set to True if it has been found already
const INSTANCE_NUM_ATTRIBUTE_NAME = "instance_number";    // Attribute to store the XML Node's instance number
const XML_FILE_TYPE = "text/xml";
const PRODUCT_PREFIX = "Product_";

// Global variables
// First XML Node found in the XML tree for the Current step
let g_firstXmlNodeFoundForCurrentStep = null;

/**
 * Initialize the wizard using jQuery-Steps built-in method.
 *
 * Note: Several aspects of the wizard are controlled within functions called in the
 * onStepChanging and onStepChanged methods of the wizard's settings object.
 */
function initWizard(wizard) {
    var settings = {
        /* Appearance */
        headerTag: "h3",
        bodyTag: "section",
        contentContainerTag: "div",
        actionContainerTag: "div",
        stepsContainerTag: "div",
        cssClass: "wizard",
        stepsOrientation: $.fn.steps.stepsOrientation.vertical,

        /* Templates */
        titleTemplate: '<span class="number">#index#.</span> #title#',
        loadingTemplate: '<span class="spinner"></span> #text#',

        /* Behaviour */
        autoFocus: false,
        enableAllSteps: false,
        enableKeyNavigation: true,
        enablePagination: true,
        suppressPaginationOnFocus: true,
        enableContentCache: true,
        enableCancelButton: false,
        enableFinishButton: true,
        preloadContent: false,
        showFinishButtonAlways: false,
        forceMoveForward: false,
        saveState: false,
        startIndex: 0,

        /* Transition Effects */
        transitionEffect: $.fn.steps.transitionEffect.none,
        transitionEffectSpeed: 0,

        /* Events */
        onStepChanging: function (event, currentIndex, newIndex) {
            removePopovers();
            if (newIndex === 0 && currentIndex > newIndex){
                return false;
            }
            if (updatePopUp(currentIndex)) {
                return showPopUp(currentIndex, newIndex);
            }
            if (progressData === null)
                progressData = [];
            if (!g_state.loading && currentIndex < progressData.length){

                // when a class from a previous page is removed, handle recursive removal
                // of that page and skip the addition steps below
                var classRemoved = false;
                // console.log('*** ',progressData[currentIndex]['step']);
                switch (progressData[currentIndex]['step']){
                    case 'discipline_dictionaries':
                        classRemoved = areDifferentDisciplineNodes(progressData[currentIndex]);
                        break;
                    case 'optional_nodes':
                        classRemoved = areDifferentOptionalNodes(progressData[currentIndex]);
                        break;
                }
                if(classRemoved) {
                    console.log("skipping step addition");
                    // Something was removed, skip addition steps
                    return;
                }
            }
            if (newIndex > currentIndex){

                // TODO - we should do a check here to figure out what
                // page we are on and determine where to go from there
                handleStepAddition(currentIndex, newIndex, progressData[currentIndex]);
                handleMissionSpecificsStep(currentIndex, newIndex);
                handleExportStep(newIndex);
                discNodesSelection(currentIndex);
                discNodeHideMissing(newIndex);

                // Assign step/data-path to LHS navigation bars
                stepLhsNav = $('#wizard-t-'+currentIndex);
                if(progressData[currentIndex] === undefined){
                    console.log(stepLhsNav.text());
                }
                else if(progressData[currentIndex] !== undefined && progressData[currentIndex]['step'] === "product_type"){

                }
            }
            $("ul[role='menu']").show();
            updateActionBar(newIndex);
            return true;
        },
        onStepChanged: function (event, currentIndex, priorIndex) {
            wizardData.currentStep = currentIndex;

            var stepContent = $("#wizard-p-" + priorIndex);
            //progressObj['step_path'] = $(".optional-section", stepContent).attr("step_path");
            if(g_state.loading && typeof $(".optional-section", stepContent).attr("no_save_data") != 'undefined') {

            } else {
                if (currentIndex > priorIndex) {
                    var priorStepHeading = $("#wizard-t-" + priorIndex.toString());
                    var priorStepTitle = (/[A-Za-z].+/.exec(priorStepHeading.text())[0].replace(/ /g, "_"));
                    insertCheckmark(priorStepHeading);

                    var currStepHeading = $("#wizard-t-" + currentIndex.toString());
                    //parse the step title from the overall step element (in the left sidebar)
                    var currStepTitle = (/[A-Za-z].+/.exec(currStepHeading.text())[0].replace(/ /g, "_"));
                    prepXML(currStepTitle, false); // XML validation disabled until integrated into tool

                    if ((typeof progressData != "undefined" || progressData != null) && !g_state.loading) {
                        // need to only call storeprogress when appropriate
                        storeProgress(priorIndex, priorStepTitle, (priorIndex + 1 > progressData.length));
                        if (currentIndex > priorIndex){
                            handleStepAddition(priorIndex, currentIndex, progressData[priorIndex]);
                        }
                    }
                }
            }
            if (currentIndex >= wizardData.maxStep) {
                wizardData.maxStep = currentIndex;
            }
            resetMissionSpecificsBuilder(priorIndex);
            $("#help").empty();
            previewDescription();
            $("#help").fadeIn(400);

        },
        onCanceled: function (event) { },
        onFinishing: function (event, currentIndex) { return true; },
        onFinished: function (event, currentIndex) {
            insertCheckmark($("#wizard-t-" + currentIndex.toString()));

            window.location = "dashboard.php";
        },

        /* Labels */
        labels: {
            cancel: "Cancel",
            current: "-> ",
            pagination: "Pagination",
            finish: "Finish",
            next: "Save & Go To Next",
            previous: "Previous",
            loading: "Loading ..."
        }
    };
    // window.location.replace(location)
    wizard.steps(settings);
}
/**
 * Since the wizard object is controlled by jQuery-Steps, it is
 * set to a specific height based on its content. We want to match this
 * height for the sidebar on the right and for the steps bar on the left.
 * @param {object} wizardContent portion of the wizard
 * @param {object} wizardActions bar portion of the wizard
 * @param {object} sidebar
 * @param {object} stepsBar
 */
function matchWizardHeight(wizardContent, wizardActions, sidebar, stepsBar){
    $(sidebar).css("height", $(wizardContent).height() + $(wizardActions).height());
    $(stepsBar).css("height", $(wizardContent).height() + $(wizardActions).height());
}
/**
 * Handles the dynamic creation of new steps populated with data from the product
 * object created from the PDS4 JSON. This function looks up the corresponding object
 * for each element bar in a step, checks if the user opted to add that object,
 * and adds a new step accordingly.
 * @param {number} currentIndex for the current step in the wizard
 * @param {number} newIndex for the next step in the wizard
 */
function handleStepAddition(currentIndex, newIndex, stepObj){
    var insertionIndex = newIndex;


    // Indent step bars on LHS nav to show step hierarchy
    var currStep = $('#wizard-t-' + currentIndex);
    var currStepPath = currStep.attr('path');
    if(currStepPath !== undefined){
        currStep.parent().css('padding-left', currStep.attr('path').split('/').length * 10 );
    }

    var currSection = $("#wizard-p-" + currentIndex.toString());
    var hasRun = false;
    if ($(".optional-section", currSection).length > 0){
        var parentObj = $(".optional-section", currSection);
        $(".element-bar", currSection).each(function(barIndex, value){
            if(!$(this).hasClass("stepAdded")) {
                var val = $(".element-bar-counter", this).val();
                var metadata = "";
                if ($(".element-bar-input", this).length != 0) {
                    metadata = $(".element-bar-input", this).val();
                } else if($(".selectpicker", this).length != 0) {
                    //  Get the value dropdown list's selection
                    var valueDropdownSelection = $(".selectpicker", this).val();
                    //  IF the selection is NOT the "No Selection" option
                    if (valueDropdownSelection !== VALUE_DROPDOWN_LIST_NO_SELECTION) {
                        metadata = valueDropdownSelection;
                    }
                }
                //  Get the selected unit value from the Unit dropdown list
                var unitValue = "";
                //  Get the element in this elementBar with both the selectpicker and unitchooser classes
                if ($(".selectpicker.unitchooser", this).length != 0) {
                    //  Get the Unit dropdown list's selection
                    var unitDropdownSelection = $(".selectpicker.unitchooser", this).val();
                    //  IF the selection is NOT the "No Selection" option
                    if (unitDropdownSelection !== UNIT_DROPDOWN_LIST_NO_SELECTION) {
                        unitValue = unitDropdownSelection;
                    }
                }

                var path = $(this).attr("data-path");

                var currObj = getObjectFromPath(path, g_jsonData.refObj);

                if (typeof $(this).attr("data-path-corrected") != 'undefined') {
                    //  Fix for Issue #72:
                    //  Verify that there is a valid object associated with this corrected path,
                    //  before you set it as the path of the current object
                    var correctedPath = $(this).attr("data-path-corrected");
                    var correctedObj = getObjectFromPath(correctedPath, g_jsonData.refObj);
                    if (correctedObj != null) {
                        currObj["path"] = correctedPath;
                    } else {
                        console.log("The corrected path '" + correctedPath + "' is not a valid path.");
                    }
                }


                // TODO -   this val check doesn't seem good enough.
                //          the else if is intended to handle the initial
                //          IM ingestion. everything else should fall under here
                if (val !== "0") {

                    if (currentIndex === 1) {
                        wizardData.mainSteps.push(currObj['title']);

                        if (!hasRun) {
                            prepXML(currObj['title'], false); // XML validation disabled until integrated into tool
                            hasRun = true;
                        }
                    }


                    //- if the "next" property is defined, then it is a class with children (not an attribute) so
                    //  a step should be added
                    //- if the "title" property equals "Mission_Area" or
                    //- if the "title" property equals "Discipline_Area, then it is a special section handled later in the
                    //  tool and a step should not be added
                    if (currObj['next'] !== undefined && currObj['title'] !== "Mission_Area" && currObj['title'] !== "Discipline_Area") {

                        insertStep($("#wizard"), insertionIndex, currObj, g_jsonData.namespaces[g_state.nsIndex], val, currentIndex);

                        for(var i = 1; i <= val; i++) {
                            wizardData.stepPaths.splice(insertionIndex - getStepOffset(insertionIndex), 0, currObj['path'] + "[" + i + "]");
                            insertionIndex += 1;
                            wizardData.allSteps.push(currObj['title']);
                        }

                    }
                    $(this).addClass("stepAdded");
                    if (typeof $(this).attr("data-path-corrected") != 'undefined') {
                        path = $(this).attr("data-path-corrected"); // some attributes/classes are generic and need to apply to the current class
                    }
                    backendCall("php/xml_mutator.php",
                        "addNode",
                        {path: path, quantity: val, value: metadata, unit: unitValue, ns: g_jsonData.namespaces[g_state.nsIndex]},
                        function (data) {
                        });

                    // IF in Import mode
                    ///if (g_importedXmlDoc != null) {
                        // This inserted step will be automatically populated w/ import data
                        // Auto-advance to the next step after populating this step w/ import data
                    ///    $("#wizard").steps("next");
                    ///}

                }
            }

        });

    }

}
/*
 * Insert a step into the wizard at the specified index with content
 * generated from the specified data object.
 * @param {Object} wizard
 * @param {Number} index zero-based position indicating where in the wizard to insert the step
 * @param {Object} dataObj object containing the PDS data to generate content from
 */
function insertStep(wizard, index, dataObj, ns, quantity){

    if(index > wizardData.maxStep) {
        revertStepClass(index);
    }
    // Get the node name from the g_dictInfo global
    var nodeName = g_dictInfo[g_jsonData.namespaces[g_state.nsIndex]].name;
    var title = (dataObj["title"] ? dataObj["title"].replace(/_/g, " ") : nodeName);
    var data = (dataObj["next"] ? dataObj["next"] : dataObj);

    if(quantity > 1) {
        for(var i = quantity; i > 0; i--) {
            wizard.steps("insert", index, {
                title: title + " #" + i,
                content: generateContent(title, data, dataObj, ns, i, quantity)
            });

            var pathComponents = $('#wizard-p-' + index).children().children().children()[0]['attributes']['data-path-corrected']['nodeValue'].split('/');
            pathComponents.splice(pathComponents.length-2,2);
            // $('#wizard-t-' + index).attr("path", dataObj['path']); // ORIGINAL assign path attributes to the step on the LHS nav
            $('#wizard-t-' + index).attr("path", pathComponents.join("/")); // assign path attributes to the step on the LHS nav
            $('#wizard-p-' + index).attr("path", pathComponents.join("/")); // assign path attributes to the section for pertaining step
            $('#wizard-t-' + index).addClass("lhs-nav-bars");
        }
    } else {
        wizard.steps("insert", index, {
            title: title,
            content: generateContent(title, data, dataObj, ns, 1, quantity)
        });

        $('#wizard-t-' + index).attr("path", dataObj['path']); // assign path attributes to the step on the LHS nav
        $('#wizard-p-' + index).attr("path", dataObj['path']); // assign path attributes to the section for pertaining step
        $('#wizard-t-' + index).addClass("lhs-nav-bars");
    }

    $(".selectpicker").selectpicker("render"); // select pickers need to rendered after being appended;
}
/**
 * Generate the content section for a new step in the wizard. This function also gets the
 * next level of associations for future reference in the data object. This data storing
 * is sequential because the JSON is too large to parse all at once.
 * @param {string} sectionTitle title of the current section from object data
 * @param {Object} dataObj object containing the PDS data to generate content from
 *@param {Object} parentObj parent class of the dataObj
 *@param {String} namespace of dataObj
 *@param {number} iteration of this object - if a users adds 3 of the same class this indicates which the current is
 *@param {number} total iterations of this object
 * @return {Element} section
 */
function generateContent(sectionTitle, dataObj, parentObj,ns, iteration, quantity){
    // Set to Null, to indicate that an XML node has not been found yet for this new step
    g_firstXmlNodeFoundForCurrentStep = null;
    var parentPath = parentObj["path"];
    if(sectionTitle == g_dictInfo["pds"]["name"]) { // TODO - FIX WHEN LABEL ROOT has a [1] prepended - this is just looking for "LABEL ROOT"
        parentPath = g_dictInfo["pds"]["name"];
    }
    var section = document.createElement("div");
    $(section).attr("namespace", ns);
    $(section).attr("step_path", parentPath);
    section.className = "optional-section";
    var question = document.createElement("p");
    question.className = "question";
    question.innerHTML = "What elements do you want to keep in '" + sectionTitle.charAt(0).toUpperCase() + sectionTitle.slice(1) + "'?";
    if(quantity > 1) {
        // This is one of many appended classes. Label each one with a number
        question.innerHTML = "What elements do you want to keep in '" + sectionTitle.charAt(0).toUpperCase() + sectionTitle.slice(1) + "' #" + iteration + "?";
        $(section).attr("iteration", iteration);
        if(sectionTitle != g_dictInfo["pds"]["name"]) {
            parentPath = parentPath + "[" + iteration + "]";
        }

    } else {
        if(sectionTitle != g_dictInfo["pds"]["name"]) {
            parentPath = parentPath + "[1]";
        }
        $(section).attr("iteration", 1);
    }


    section.appendChild(question);
    var subsection = document.createElement("div");
    subsection.className = "data-section";
    // need to sort before iterating through
    var indexArray = [];
    var indexLookup = $.map(dataObj, function(value, index) {
        return [value];
    });
    var dataArray = $.map(dataObj, function(value, index) {
        return [value];
    });
    dataArray.sort(function(a, b) {
        return a[Object.keys(a)[0]].classOrder - b[Object.keys(b)[0]].classOrder;
    });

    $.each(dataArray, function(key, value) {

        indexArray.push(indexLookup.indexOf(value));
    });

    for (var curIndex in indexArray){
        var index = indexArray[curIndex];
        var counter = 0, flag = false;
        var choicegroup;
        for (var key in dataObj[index]){
            counter += 1;
        }
        dataObj[index].length = counter;
        key = "";
        for (key in dataObj[index]){
            var currObj = dataObj[index][key];
            if(typeof currObj["associationList"] != 'undefined') {
                for (var k = 0; k < currObj["associationList"].length; k++) {
                    if (currObj["associationList"][k]["association"]["assocType"] == "parent_of") {
                        currObj.generalization = currObj["associationList"].splice(k, 1)[0];
                    }
                }
            }

            //get immediate associations for creating next steps/element-bars
            getAssociations(g_jsonData.searchObj, currObj, currObj["next"]);

            // TODO: I think this is where we will need to add the node top-level path
            assignObjectPath(index, currObj, currObj["next"]);

            //need to get one more level of associations for displaying sub-elements in the popovers
            getLevelOfAssociations(g_jsonData.searchObj, currObj["next"], false);
            if ($.inArray(currObj["title"], invalidElementsInJSON) !== -1){

            }
            else if (dataObj[index].length === 1){
                if (currObj["title"] === "Mission_Area" ||
                    currObj["title"] === "Discipline_Area"){
                    currObj["range"] = "1-1";
                }
                subsection.appendChild(createElementBar(currObj, createLabel, false, parentPath));
            }
            else {
                var range = currObj["range"].split("-");
                if (!flag){
                    choicegroup = createChoiceGroup(range[0], range[1]);
                }
                range[0] = (range[0] === "0" ? range[0] : (parseInt(range[0], 10) - 1).toString());
                currObj["range"] =  range[0] + "-" + range[1];
                choicegroup.appendChild(createElementBar(currObj, createLabel, true, parentPath));
                flag = true;
            }
        }
        if (flag){ subsection.appendChild(choicegroup); }
    }
    section.appendChild(subsection);
    return section;
}
/**
 * Create an element-bar populated with data from the specified object.
 * @param {object} dataObj object containing the information for the element-bar
 * @param {function} genLabel function to create the label portion of the element-bar
 * @param {bool} isChoice denotes whether this element-bar is in a choice group or not
 * @return {Element} elementBar
 */
function createElementBar(dataObj, genLabel, isChoice, parentPath){
    var elementBar = document.createElement("div");
    elementBar.className = "input-group element-bar";

    // In order to ensure the elementBar ID is unique, we need to append
    // a counter to the identifier based on the number of elements
    // that already exist with this identifier prefix
    // elCounter = $("[id^="+dataObj["identifier"]+"]").length;
    var elements = "[id^=" + dataObj["identifier"].replace(/\./g,'\\.') + "]";
    elCounter = $(elements).length;
    elementBar.id = dataObj["identifier"] + "." + elCounter;

    // Set the data path. This is the traversal path through the JSON
    elementBar.setAttribute('data-path', dataObj["path"]);
    var specificPath = dataObj["path"];     // the specific path under the parent
    // IF the dataObj[path] does NOT start with the parentPath AND parentPath is defined AND parentPath does NOT start with the string "undefined" AND  it's not 'Label Root'
    if(!dataObj["path"].startsWith(parentPath) && typeof parentPath != 'undefined' && !parentPath.startsWith('undefined') && parentPath != g_dictInfo["pds"]["name"]) {
        // console.log("Need to correct " + dataObj["path"] + " with parent " + parentPath);
        var arrayPath = dataObj["path"].split("/");
        parentPath = parentPath + "/" + arrayPath[arrayPath.length-2] + "/" + arrayPath[arrayPath.length-1];
        // console.log("Corrected path: " + parentPath);
        elementBar.setAttribute('data-path-corrected', parentPath);
        // Internal References have a generic path in dataObj.path, so need to use the parent path
        specificPath = parentPath;
    }
    var label = genLabel(dataObj["title"], isChoice);
    elementBar.appendChild(label);

    if (dataObj['next'] === undefined){
        $(elementBar).addClass("valueElementBar");
        $(label).addClass("hasInput");
        var input = createValueInput(dataObj);
        elementBar.appendChild(input);

        //  Create a Unit dropdown list based on the Unit Id
        var unitDropdown = createUnitDropdown(dataObj);
        if (unitDropdown != null) {
            elementBar.appendChild(unitDropdown);
        }
    }
    var minusBtn = createControlButton("minus");
    elementBar.appendChild(minusBtn);
    var plusBtn = createControlButton("plus");

    var counter = createCounterInput(dataObj);


    if ($(counter).prop("value") === $(counter).prop("max")){
        $("button", plusBtn).prop("disabled", true);
    }
    //  IF the min is 0, the value is set to 0 too
    if ($(counter).prop("min") === "0") {
        label.className += " zero-instances";
        $(input).prop('disabled', true);
        //  Disable the Unit dropdown list
        $(unitDropdown).prop('disabled', true);
    }
    if (isChoice){
        $(counter).prop("disabled", true);
        $(counter).css("opacity", 1);
    }
    $("button", minusBtn).prop("disabled", true);
    elementBar.appendChild(counter);

    elementBar.appendChild(plusBtn);

    addPopover(elementBar, dataObj, $(counter).prop("min"), $(counter).prop("max"), isRecommended);

    //console.log('g_importedXmlDoc =', g_importedXmlDoc);

    // IF an XML file was imported
    if (g_importedXmlDoc != null) {
        // Look in the XML DOM Tree for elements with this Path
        let xmlNodeFound = null;
        // IF an XML node has NOT yet been found for this step
        if (g_firstXmlNodeFoundForCurrentStep == null) {
            ///console.log("Looking in the XML DOM tree for '" + specificPath + "'");
            // Get all the child nodes of the root
            const childNodeArray = g_importedXmlDoc.childNodes;
            let productTypeNode = null;
            // Find the Product_Type node
            for (let c=0; c < childNodeArray.length; c++) {
                // IF the child node name starts with "Product_"
                if (childNodeArray[c].nodeName.startsWith(PRODUCT_PREFIX)) {
                    productTypeNode = childNodeArray[c];
                    break;
                }
            }
            // IF found the Product_Type node
            if (productTypeNode !== null) {
                // Look in the XML DOM Tree for just the XML node with this Data Object's specific Path
                xmlNodeFound = findXMLNodeWithPath(specificPath, 0, productTypeNode);
                // Save the first XML Node found for the current step,
                // because all the other elements in this step must be siblings of this XML Node
                g_firstXmlNodeFoundForCurrentStep = xmlNodeFound;
            }

        } else {
            // Look only in the siblings of the XML node that was first found for this step
            xmlNodeFound = findXMLNodeInSiblings(specificPath, g_firstXmlNodeFoundForCurrentStep);
        }

        // IF did NOT Find a match
        if (xmlNodeFound === null) {
            //console.log("Did NOT Find a matching node in the XML DOM tree for '" + dataObj["path"] + "'");
        } else {
            //console.log("Found a matching node in the XML DOM tree for '" + dataObj["path"] + "'!");
            //console.log("xmlNodeFound =", xmlNodeFound);
            //  Get the count of the sibling nodes with this name
            const xmlNodeCount = getCountOfSiblingNodesWithSameName(xmlNodeFound);
            // Get the counter of the element bar
            const elementBarCount = $(".element-bar-counter", elementBar).val();
            //console.log('Element Bar Count = ' + elementBarCount);
            // Press the Plus button the # of times needed to set the value correctly
            for (let ct = elementBarCount; ct < xmlNodeCount; ct++) {
                // Increment the counter by clicking the Plus button
                // So the choice group total will get incremented
                $("button", plusBtn).click();
                //need to call this function to reset the properties of the element bar
                //after the adjustments have been made to load the XML node values
                setOneElementBarStyle($(counter));
            }
            // Get the text & unit info. from the XML node
            const xmlNodeTextUnitData = getInfoOutOfNode(xmlNodeFound);

            const unitValue = xmlNodeTextUnitData.unit;
            // If there is a 'Unit' attribute for the XML node
            if (unitValue != null) {
                //console.log('Unit attribute of node is "' + unitValue + '"');
                // Set the Unit attribute of the element bar
                // At this early stage, the Unit dropdown has not become a bootstrap toggle button?
                // The div tag that bootstrap wraps the select element does not exist yet,
                // so it is not found by the JQuery call
                // So try just setting the select element directly the old-fashioned way
                //$(unitDropdown).value = unitValue;
                //  Set the element in elementBar with the unitchooser class
                $(".unitchooser", elementBar).selectpicker("val", unitValue);
                //$(unitDropdown).selectpicker("val", unitValue);
                //$(unitDropdown).selectpicker('refresh');
                $(".unitchooser", elementBar).selectpicker('refresh');
                //need to call this function to reset the properties of the element bar
                //after the adjustments have been made to load the XML node values
                //setOneElementBarStyle($(".element-bar-counter", elementBar));
                setOneElementBarStyle($(counter));
            }
            const textOfNode = xmlNodeTextUnitData.text;
            // IF there is a text value for the XML node
            if (textOfNode != null) {
                // Set the text as the element bar value
                // Set the selected value of the dropdown list
                $(".selectpicker", elementBar).selectpicker("val", textOfNode);
                // Set the value of the text input
                $(".element-bar-input", elementBar).val(textOfNode);
            }
        }       // end IF-Else xmlNodeFound == null
    }       // end IF an XML file was imported


    // Highlight the element bar if this item is in the list of recommendedElementDataPaths
    var isRecommended = false;
    recommendedElementDataPaths.forEach(function(path) {
        if(dataObj["path"].match(path)){
            elementBar.style.cssText = 'box-shadow: 0 0 15px #00F5FF;';
            isRecommended = true;
        }
    });

    //  IF in Basic Mode
    if (g_isBasicMode) {
        //  Show/Hide the element bar based on the Mode and whether it is in the Advanced Mode Element config list
        showHideAdvancedElementBar(elementBar);
    }

    //  For each item in the deprecatedElementDataPaths config array
    for (var i=0; i < deprecatedElementDataPaths.length; i++) {
        //  IF this element has a data path that matches a regular expression in the deprecatedElementDataPaths config array
        if (dataObj["path"].match(deprecatedElementDataPaths[i])) {
            //  Hide the element completely when it's deprecated
            ///elementBar.style.display = "none";
            //  Hide the element when it's deprecated, but leave an empty line where it should be
            elementBar.style.visibility = "hidden";
            break;  //  break out of For loop
        }
    }

    return elementBar;
}
/**
 * Create a span to act as a label with the specified text. If it is inside
 * of a choice group, then there is slightly different formatting.
 * @param {string} text
 * @param {bool} isChoice denotes whether this element-bar is in a choice group or not
 * @return {Element} label
 */
function createLabel(text, isChoice){
    var label = document.createElement("span");
    label.className = "input-group-addon element-bar-label";
    if (isChoice) {
        label.innerHTML = "<i>" + text.replace(/_/g, " ") + "</i>";
        label.className += " option";
    }
    else {
        label.innerHTML = text.replace(/_/g, " ");
    }
    return label;
}
/**
 * Create an input form for metadata within the label elements.
 * @returns {Element}
 */
function createValueInput(dataObj){
    if(typeof(dataObj.PermissibleValueList) != 'undefined') {
        // Make dropdown with permissible values
        var permissibleSelect = document.createElement("select");
        $(permissibleSelect).attr("data-width", "36.5%");
        $(permissibleSelect).attr("data-container", "body");
        $(permissibleSelect).attr("title", "Choose a value");
        $(permissibleSelect).addClass("selectpicker");

        //  Have the 1st Dropdown list option be "No item selected"
        var permissibleOption = document.createElement("option");
        $(permissibleOption).text(VALUE_DROPDOWN_LIST_NO_SELECTION);
        //$(permissibleOption).attr("data-subtext", current_value.valueMeaning); -disabled until bootstrap is stable
        $(permissibleSelect).append(permissibleOption);
        $(permissibleOption).attr("name", VALUE_DROPDOWN_LIST_NO_SELECTION);

        for(var i = 0; i< dataObj.PermissibleValueList.length; i++) {
            var current_value = dataObj.PermissibleValueList[i].PermissibleValue;
            permissibleOption = document.createElement("option");
            $(permissibleOption).text(current_value.value);
            //$(permissibleOption).attr("data-subtext", current_value.valueMeaning); -disabled until bootstrap is stable
            $(permissibleSelect).append(permissibleOption);
            $(permissibleOption).attr("name", current_value.text);
            $(permissibleOption).popover({
                container: "body",
                title: "Definition",
                content: current_value.valueMeaning,
                trigger: "hover",
                selector: true
            });
        }

        //  Default certain dropdown lists to a particular value
        defaultDropdownValue(permissibleSelect, dataObj['identifier']);

        return permissibleSelect;
    } else {
        var input = document.createElement("input");
        input.className = "form-control element-bar-input";
        input.type = "text";
        input.placeholder = "Enter value (optional)";

        //  Set the Data Type into an input element attribute
        var dataTypeId = dataObj["dataTypeId"];
        if (dataTypeId !== undefined) {
            input.setAttribute('data-type-id', dataTypeId);
        }

        //  Call a function when the input text control contents are changed by the user
        ///input.onkeyup = function() { console.log("Text Input control value changed to '" + input.value + "'"); };
        input.oninput = validateTextInput;

        return input;
    }
}
/**
 * Create a dropdown list for selecting the element's Unit of measure.
 * @param {object} dataObj - object that contains the Unit Id
 * @returns {Element}
 */
function createUnitDropdown(dataObj){
    var permissibleSelect = null;

    //  Look up the actual Units based on the UnitId in the given data object
    var unitCSVList = dataObj.unitId;
    if ((unitCSVList !== undefined) && (unitCSVList !== null) && (unitCSVList !== "null")) {
        var unitArray = unitCSVList.split(",");
        if (unitArray.length > 0) {
            // Make dropdown list with the permissible Units
            permissibleSelect = document.createElement("select");
            $(permissibleSelect).attr("data-width", "10.0%");
            $(permissibleSelect).attr("data-container", "body");
            $(permissibleSelect).attr("title", "Choose a unit");
            $(permissibleSelect).addClass("selectpicker");
            //  Add another class to make it distinct from the Value dropdown list
            $(permissibleSelect).addClass("unitchooser");

            //  Have the 1st Dropdown list option be "No unit selected"
            var permissibleOption = document.createElement("option");
            $(permissibleOption).text(UNIT_DROPDOWN_LIST_NO_SELECTION);
            //$(permissibleOption).attr("data-subtext", current_value.valueMeaning); -disabled until bootstrap is stable
            $(permissibleSelect).append(permissibleOption);
            $(permissibleOption).attr("name", UNIT_DROPDOWN_LIST_NO_SELECTION);

            for (var u=0; u < unitArray.length; u++) {
                permissibleOption = document.createElement("option");
                //  Set the text of the option
                $(permissibleOption).text(unitArray[u].trim());
                $(permissibleSelect).append(permissibleOption);
                $(permissibleOption).attr("name", unitArray[u].trim());
            }
        }
    }

    return permissibleSelect;
}
/**
 * Validate the contents of the Text Input control
 * Called when the input text control contents are changed by the user.
 */
function validateTextInput() {
    var newValue = this.value;
    ///console.log("Text Input control value changed to '" + this.value + "'");

    //  Get the Data Type from the text input control's attribute
    var dataTypeId = $(this).attr("data-type-id");

    if (dataTypeId !== undefined) {
        //  Find the Data Type Dictionary entry for this Data Type
        var dataTypeDict = g_jsonData.nodes.pds.dataDictionary.dataTypeDictionary;
        for (var d=0; d < dataTypeDict.length; d++) {
            var dataTypeDictEntry = dataTypeDict[d].DataType;
            if (dataTypeDictEntry.identifier === dataTypeId) {
                //  Get the Pattern List for this Data Type
                var patternList = dataTypeDictEntry.patternList;
                if (patternList !== undefined) {
                    var isAPatternMatched = false;
                    for (var p=0; p < patternList.length; p++) {
                        var patternVal = patternList[p].Pattern.value;
                        //  Match just this pattern, not this pattern plus anything before or after
                        var patternWithLimiters = "^" + patternVal + "$";
                        //  Apply the pattern to the input element's value
                        //  IF the new value matches the regular expression in the patternList array
                        ///if (newValue.match("[0-9]")) {    //  IF the input contains a digit
                        if (newValue.match(patternWithLimiters)) {
                            isAPatternMatched = true;
                            break;  //  out of patternList loop
                        }
                    }
                    if (isAPatternMatched) {
                        this.style.color = "green";
                    } else {
                        this.style.color = "red";
                        //  Get the parent element bar
                        ///var parentElementBar = this.parentElement;
                        //  Get the parent element bar's popover
                        ///var popover = $(parentElementBar).data('popover');
                        //  Get the contents of the popover
                        ///var popoverContents = popover.options.content;
                        ///content.log("Popover contents: " + popoverContents);
                    }
                }
                break;  //  out of dataTypeDict loop
            }
        }
    }
}
/**
 * Create a plus or minus button for controlling the form in an element-bar.
 * @param {string} type ["plus" | "minus"]
 * @return {Element} wrapper
 */
function createControlButton(type){
    var btnClass, iconClass, handler;
    if (type === "plus"){
        btnClass = "element-bar-plus";
        iconClass = "fa fa-plus fa-fw";
        handler = increaseCounter;
    }
    else{
        btnClass = "element-bar-minus";
        iconClass = "fa fa-minus fa-fw";
        handler = decreaseCounter;
    }
    var wrapper = document.createElement("span");
    wrapper.className = "input-group-btn element-bar-button";

    var btn = document.createElement("button");
    btn.className = "btn btn-secondary " + btnClass;
    $(btn).attr("type", "button");
    $(btn).click(handler);

    var icon = document.createElement("i");
    icon.className = iconClass;
    $(icon).attr("aria-hidden", "true");

    btn.appendChild(icon);
    wrapper.appendChild(btn);

    return wrapper;
}
/**
 * Create a counter input (populated with data from the specified object) for
 * tracking how many elements the user wants of a specific type.
 * Note: if the max is infinite, then it is set as 9999999999.
 * @param {Object} dataObj object containing the PDS data to generate content from
 * @return {Element} counter
 */
function createCounterInput(dataObj) {
    var counter = document.createElement("input");
    counter.className = "form-control element-bar-counter";

    var min = parseInt(dataObj["range"].split("-")[0], 10);
    var max = dataObj["range"].split("-")[1];
    max = (max === "*" ? 9999999999 : parseInt(max, 10));
    if (min === max) {
        $(counter).prop("disabled", true);
    }

    $(counter).attr("min", min);
    $(counter).attr("max", max);
    $(counter).prop("value", min);
    $(counter).attr("type", "number");

    $(counter).focus(captureValue);
    $(counter).keypress(preventInput);
    $(counter).keyup(validateInput);
    $(counter).focusout(releaseValue);

    return counter;
}
/**
 * Create a wrapper div with a label for denoting a group of element choices.
 * @param {string} min minimum total value for the choice group
 * @param {string} max maximum total value for the choice group
 * @return {Element}
 */
function createChoiceGroup(min, max) {
    var cg = document.createElement("div");
    cg.className = "choice-field";
    var label = document.createElement("div");
    label.className = "choice-prompt";
    max = (max === "*" ? "9999999999" : max);
    if (min === max && min === "1") {
        label.innerHTML = "You must keep <b>one</b> of these options:";
    }
    else if (min < max && min === "0") {
        label.innerHTML = "You may <b>keep or remove</b> these options:";
    }
    else {
        label.innerHTML = "You must keep <b>at least</b> one of these options:";
    }

    $(cg).attr("min", min);
    $(cg).attr("max", max);
    $(cg).attr("total", (min === "0" ? parseInt(min) : parseInt(min, 10) - 1));

    cg.appendChild(label);
    return cg;
}

/**
 * When steps are added to the wizard, the step that was originally going to be
 * navigated to next loses the disabled class. That class controls the styling
 * and functionality of the step element. This function adds that class back in as
 * necessary.
 * @param {number} index of the original next step
 */
function revertStepClass(index) {
    var origNextStep = $("#wizard-t-" + index.toString()).parent();
    if (!$(origNextStep).hasClass("disabled")) {
        $(origNextStep).addClass("disabled");
    }
}
/*
 * If this is a main section (that was dynamically added), remove all of its
 * child nodes from the XML file.
 * Before it removes the nodes, check if the XML is valid.
 * TODO: Once the PDS4 JSON is bug-free and directly matches the schema, complete validation functionality.
 * @param {string} sectionHeading title of the section
 * @param {bool} isValidating controls call of XML validator
 * Note: since the main sections are always on the first level of the XML, the
 * section's heading is also the section's path.
 */
function prepXML(sectionHeading, isValidating){
    if ($.inArray(sectionHeading, wizardData.mainSteps) !== -1){
        if (isValidating) {
            backendCall("php/xml_mutator.php",
                "addRootAttrs",
                {namespaces: g_jsonData.namespaces},
                function(data){});
            backendCall("php/xml_validator.php",
                "validate",
                {},
                function(data){});

        }
        backendCall("php/xml_mutator.php",
            "removeRootAttrs",
            {namespaces: g_jsonData.namespaces},
            function(data){});
        /*
         backendCall("php/xml_mutator.php",
         "removeAllChildNodes",
         {path: sectionHeading, ns: ""},
         function(data){});
         */
    }
}
/**
 * After a user has completed a step, replace the step number with a check mark.
 * @param {Object} stepHeading
 */
function insertCheckmark(stepHeading){
    var number = $(".number", stepHeading)[0];
    number.innerHTML = "<i class=\"fa fa-check fa-fw\" aria-hidden=\"true\"></i>";
}

/**
 * Called when the user has toggled the Basic Mode toggle button.
 */
function basicModeToggled(isBasicMode){
    ///console.log("Basic Mode = " + isBasicMode);
    //  Store the value into a global
    g_isBasicMode = isBasicMode;
    //  Get all of the element bars in the entire document
    var elementBarList = document.getElementsByClassName("input-group element-bar");
    for (var e=0; e < elementBarList.length; e++) {
        //  Show/Hide the element bar based on the Mode and whether it is in the Advanced Mode Element config list
        showHideAdvancedElementBar(elementBarList[e]);
    }
}

/**
 * Show/Hide the given element bar based on the Mode and whether it is in the Advanced Mode Element config list.
 */
function showHideAdvancedElementBar(elementBar) {
    var dataPath = elementBar.getAttribute("data-path");

    //  For each item in the advancedModeElementDataPaths config array
    for (var a = 0; a < advancedModeElementDataPaths.length; a++) {
        //  IF this element has a data path that matches a regular expression in the advancedModeElementDataPaths config array
        if (dataPath.match(advancedModeElementDataPaths[a])) {
            //  IF in Basic Mode
            if (g_isBasicMode) {
                //  Hide the element completely
                ///elementBar.style.display = "none";
                //  Hide the element, but leave an empty row where it should be
                elementBar.style.visibility = "hidden";
            } else {
                //  Show the element
                ///elementBar.style.display = "inline";         //  "block";
                elementBar.style.visibility = "visible";
            }
        }
    }
}

/**
 * Find the XML Node in the XML DOM Tree with the given path
 * @param path - the slash-separated path of the Node Tree tag names
 * @param pathIndex - the index of the sub-path within the path
 * @param xmlNode - the XML DOM Tree node to start at
 */
function findXMLNodeWithPath(path, pathIndex, xmlNode) {
    let xmlNodeFound = null;         // return value
    //path = path.replace(/\[.*?\]/g, ""); // using brackets for lookup
    //console.log("path = '" + path + "'");
    let isNodeFoundSoFar = true;    // True if found a node that matches the path so far
    // Take the path, and separate it into its components
    //  Skip over the leading number
    pathArray = path.split('/');
    // While a matching node is found and not at end of path
    while (isNodeFoundSoFar && (pathIndex < pathArray.length)) {
        // Ignore the numbers, which are the even indices
        // IF the path index is Odd
        if ((pathIndex % 2) == 1) {
            const subPath = pathArray[pathIndex];
            //console.log("pathArray[" + pathIndex + "] = '" + subPath + "'");
            // Get the pathArray item's bracket value
            let bracketValue = null;
            let subPathSansBrackets = subPath;
            // IF the last char. is a closing bracket
            if (subPath.charAt(subPath.length - 1) === ']') {
                // Find the opening bracket
                const openingBracketPos = subPath.lastIndexOf("[");
                // Get the value inside the brackets
                bracketValue = subPath.substring(openingBracketPos + 1, subPath.length - 1);
                //console.log("bracket value = '" + bracketValue + "'");
                // Get the subPath in front of the brackets
                subPathSansBrackets = subPath.substring(0, openingBracketPos);
            }
            // Get all the child nodes of the current XML node
            const childNodeArray = xmlNode.childNodes;
            //console.log('childNodeArray =', childNodeArray);
            isNodeFoundSoFar = false;
            // For each child node of the current node
            for (let i = 0; i < childNodeArray.length; i++) {
                //console.log('childNodeArray[' + i + '] =', childNodeArray[i]);
                // Get the nodeName
                const nodeName = childNodeArray[i].nodeName;
                //console.log("nodeName = '" + nodeName + "'");
                // IF the nodeName = the subPath w/out brackets
                if (nodeName === subPathSansBrackets) {
                    // IF there are brackets in the subPath
                    if (bracketValue != null) {
                        // Get the instance number attribute from the node
                        const instanceNumAttrValue = childNodeArray[i].getAttribute(INSTANCE_NUM_ATTRIBUTE_NAME);
                        // IF the bracket value matches the node's instance_number attribute
                        if (bracketValue === instanceNumAttrValue) {
                            //console.log("Found a node matching the subPath '" + subPath + "'");
                            isNodeFoundSoFar = true;
                        }
                    } else {
                        //console.log("Found a node matching the subPath '" + subPath + "'");
                        isNodeFoundSoFar = true;
                    }
                    // IF found a match
                    if (isNodeFoundSoFar) {
                        // IF this is NOT the last sub-path in the path array
                        if (pathIndex < pathArray.length - 1) {
                            // Found a match, so need to recurse w/ this as the XML node, increment the pathIndex, same path
                            xmlNodeFound = findXMLNodeWithPath(path, pathIndex + 1, childNodeArray[i]);
                            // IF Found a match, can return
                            if (xmlNodeFound !== null) {
                                return xmlNodeFound;
                            }
                            // Keep looking for a match in the next sibling node
                            //break;
                        } else {
                            //console.log("Found a node matching the full path '" + path + "'");
                            // See if this node has been found and its values used already
                            // Get the Found attribute from the node
                            const foundAttrValue = childNodeArray[i].getAttribute(FOUND_ATTRIBUTE_NAME);
                            // IF this node's values have been used already
                            if (foundAttrValue != null) {
                                //console.log("This node's values have been used already.");
                            } else {    // Else return this node
                                //console.log("This node's values have NOT been used yet.");
                                // Set a Found attribute into the node
                                childNodeArray[i].setAttribute(FOUND_ATTRIBUTE_NAME, "True");
                                return childNodeArray[i];
                            }       // end IF-Else used already
                        }       // end IF-Else found node matching full path
                    }       // end IF found node matching subPath and brackets (if any)
                }       // end IF found node matching subPath only
            }       // end For each child node
        }       // end IF the path index is Odd
        pathIndex++;
    }       // end While a matching node is found and not at end of path

    return xmlNodeFound;
}

/**
 * Get the value and unit from the XML Node
 * @param xmlNode - an XML DOM Tree node of the imported XML file
 * @return xmlNodeElementData - an object that contains the number of nodes found, the value, and the Unit
 */
function getInfoOutOfNode(xmlNode) {
    // Create an object to return the values that were found
    let xmlNodeTextAndUnitData = {text: null, unit: null}
    // Get the child nodes
    const childNodeList = xmlNode.childNodes;
    // For each child node in the list
    for (c=0; c < childNodeList.length; c++) {
        // IF the child's node name is "#text"
        if (childNodeList[c].nodeName == "#text") {
            // Get the text of the XML node
            const textOfNode = childNodeList[c].nodeValue;
            //console.log('Text of node is "' + textOfNode + '"');
            // Set the text into the return object
            xmlNodeTextAndUnitData.text = textOfNode;
            // Found a match, so can fall out of this For loop
            break;
        }
    }       // end For each child node in the list

    // See if there is a 'Unit' attribute for this XML node
    const unitAttrValue = xmlNode.getAttribute(UNIT_ATTRIBUTE_NAME);
    if (unitAttrValue != null) {
        console.log('Unit attribute of node is "' + unitAttrValue + '"');
        // Set the Unit attribute into the return object
        xmlNodeTextAndUnitData.unit = unitAttrValue;
    }

    return xmlNodeTextAndUnitData;
}

// Get the count of all the sibling nodes with the same name
function getCountOfSiblingNodesWithSameName(xmlNode) {
    let nodeCount = 0;
    const xmlNodeName = xmlNode.nodeName;
    // Get the parent node of the given node
    const parentNode = xmlNode.parentNode;
    if (parentNode !== null) {
        // Get the child nodes of the parent
        const childNodeList = parentNode.childNodes;
        // For each child node in the list
        for (c=0; c < childNodeList.length; c++) {
            // IF the child's node name matches the given node's name
            if (childNodeList[c].nodeName === xmlNodeName) {
                // Increment the count
                nodeCount++;
                // Set the count into the Instance Number attribute of the XML Node
                childNodeList[c].setAttribute(INSTANCE_NUM_ATTRIBUTE_NAME, nodeCount.toString());
            }
        }       // end For each child node in the list

    }       // end IF the Parent node is not null

    return nodeCount;
}

// Find a sibling node with the given path
// @param path - the pathname to find
// @param xmlNode - the XML node to search the siblings of
// @return an XML node
function findXMLNodeInSiblings(path, xmlNode) {
    //path = path.replace(/\[.*?\]/g, ""); // remove brackets for lookup
    //console.log("path = '" + path + "'");
    //let isNodeFoundSoFar = true;    // True if found a node that matches the path so far
    // Take the path, and separate it into its components
    pathArray = path.split('/');
    //  Get the last sub-pathname in the array
    const lastSubPathname = pathArray[pathArray.length-1];
    // Get the parent node of the given node
    const parentNode = xmlNode.parentNode;
    if (parentNode !== null) {
        // Get the child nodes of the parent
        const childNodeArray = parentNode.childNodes;
        // For each child node in the list
        for (c=0; c < childNodeArray.length; c++) {
            // IF the child's node name matches the given path's last sub-pathname
            if (childNodeArray[c].nodeName === lastSubPathname) {
                //console.log("Found a node matching the last sub-path of '" + path + "'");
                // See if this node has been found and its values used already
                // Get the Found attribute from the node
                const foundAttrValue = childNodeArray[c].getAttribute(FOUND_ATTRIBUTE_NAME);
                // IF this node's values have been used already
                if (foundAttrValue != null) {
                    //console.log("This node's values have been used already.");
                } else {    // Else return this node
                    //console.log("This node's values have NOT been used yet.");
                    // Set a Found attribute into the node
                    childNodeArray[c].setAttribute(FOUND_ATTRIBUTE_NAME, "True");
                    return childNodeArray[c];
                }       // end IF-Else used already
            }       // end IF child's node name matches the given path's last sub-pathname
        }       // end For each child node in the list
    }       // end IF the Parent node is not null

    return null;
}