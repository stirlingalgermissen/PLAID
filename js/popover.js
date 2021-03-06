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
 * @file Contains the data dictionary for static popovers as well as the functions for creating
 * and controlling the popovers. These popovers show throughout the PLAID wizard to provide the
 * user with helpful descriptions to guide their decisions.
 *
 * Creation Date: 6/29/16.
 *
 * @author Trevor Morse
 * @author Michael Kim
 * @author Stirling Algermissen
 */
$(function() {
    initPopovers();
    initStaticPopovers()
});

/**
 * Data dictionary containing static content for some of the popovers.
 * @type {{context: string, document: string, file_text: string, observational: string, thumbnail: string, geometry: string, imaging: string, cartography: string, small_bodies: string, plasma_particle: string, display: string, spectra: string, wave: string}}
 */
var dict = {
    context: "A basic product identifying the physical and conceptual objects related to an observational product provenance.",
    document: "A basic product identifying a single logical document, such as a description of an instrument or even a user’s manual.",
    file_text: "A basic product with a single digital file with ASCII character encoding.",
    observational: "A basic product comprising one or more images, tables, and/or other fundamental data structures that are the result of a science or engineering observation.",
    thumbnail: "A basic product consisting of a highly reduced version of an image, typically used in displaying the results from search interfaces.",
    geometry: "Contains meta-data relating to flight paths of spacecrafts and the paths of rovers. If your mission involves the movement of any kind of vehicle, you need the geometry discipline!",
    imaging: "Contains meta-data relating to any images. This includes filters, bands, angles of cameras, temperature of cameras, etc. If your data involves any pictures at all, odds are you need the imaging discipine!",
    cartography: "Contains metadata on mapping systems. If your mission is mapping celestial information or even terrestrial, you need the Cartography node!",
    small_bodies: "Contains metadata on objects that qualify as small bodies. Asteroides, comets, dust, or anything that isn't in solar orbit",
    plasma_particle: "Contains information on the interaction between the solar wind and planetary winds with planetary magnetospheres, ionospheres and surfaces.",
    display: "Contains the details about how to display data on a device. For example, if you have movie data, then you need the Display node to explain how to use software to view the movie.",
    spectra: "Contains detail about presenting data in any kind of spectrum",
    wave: "Contains classes that describe the composition of multidimensional wave data consisting of Array (and Array subclass) data objects"
};

const FORMATION_RULE_TITLE = "<br/><b>Valid Value: </b><br/>";
const RED_GREEN_EXPLANATION = "<br/><span style='color:red;'>Red</span> is invalid, <span style='color:green;'>green</span> is valid.";
const FORMATION_RULE_KEYWORD = "formation_rule";
/**
* For each element with the class name "label-item", initialize a popover.
* The title for the popover is formed from the element's inner HTML, while
* the content for the popover is parsed out of the dict object.
*/
function initPopovers(){
    $('.label-item').each(function(){
        var title = $(this).find(".productType").html();

        if (title === undefined) {
            title = $(this).find(".discNode").html();
        }
        var key = title.trim().replace(/\b\s\b/g, "_").toLowerCase();
        $(this).popover({
            container: "body",
            html: true,
            title: title,
            content: dict[key],
            trigger: "hover"
        });
    });
}
/**
 * For each element with the class name "staticPopOver", initialize a popover.
 */
function initStaticPopovers(){
    $('.staticPopover').each(function(){
        $(this).popover({
            container: "body",
            html: true,
            title: "static title",
            content: "static content",
            trigger: "hover"
        });
    });
}
/**
* Called to dynamically add popovers as elements are added to the wizard.
* Uses data from the corresponding objects.
* @param {Element} element to add the popover to
* @param {Object} data object containing info for the popover
* @param {string} min info from element denoting minimum occurrences of the object
* @param {string} max info from element denoting maximum occurrences of the object
 */
function addPopover(element, data, min, max, isRecommended){
    if (max === "9999999999"){ max = "unbounded"; }
    var title = data["title"].replace(/_/g, " ");
    var description = "";
    if (data["isRequired"]){
        title += " (Required)";
        description = data["description"];
    }
    else {
        if (isRecommended){title += " (Recommended)";}
        else{title += " (Optional)";}

        min = "<b>Min Occurrences: " + min + "</b><br/>";
        max = "<b>Max Occurrences: " + max + "</b><br/>";
        description = min + max + data["description"];
    }

    //  Get the Formation Rule for this element's Data Type
    var formationRule = getFormationRule(data["dataTypeId"]);
    if ((formationRule !== undefined) && (formationRule.length > 0)) {
        //  Display the formation rule in the Popover
        description += FORMATION_RULE_TITLE + formationRule;
        //  Display an explanation of Red and Green colors for validation
        description += RED_GREEN_EXPLANATION;
    }

    if(data["next"] && !$.isEmptyObject(data["next"])){
        description += "<br/><b>Sub-attributes: </b><br/>";
    }
    for (var index in data["next"]){
        for (var key in data["next"][index]){
            description += "<i>- " + data["next"][index][key]["title"] + "</i><br/>";
        }
    }
    $(element).popover({
        container: "body",
        html: true,
        title: title,
        content: description,
        trigger: "manual",
        selector: true

    }).on("mouseenter", function () {
        var _this = this;
        $(this).popover("show");
        $(".popover").on("mouseleave", function () {
            $(_this).popover('hide');
        });
    }).on("mouseleave", function () {
        var _this = this;
        setTimeout(function () {
            if (!$(".popover:hover").length) {
                $(_this).popover("hide");
            }
        }, 0);
    });
}
/**
* Sometimes popovers remain on the page after the user has stopped hovering
* over the corresponding element. This will hide all remaining popovers.
 */
function removePopovers(){
    $(".label-item").popover('hide');
    $(".element-bar").popover('hide');
}
/**
 * Get the Formation Rule for the given Data Type
 * @param {string} dataTypeId the id of the data type of which to get the formation rule
 * @param {string} returns the formation rule
 */
function getFormationRule(dataTypeId) {
    var permissibleValMeaning;
    if (dataTypeId !== undefined) {
        //  Find the Class Dictionary entry for this Data Type
        var classDict = g_jsonData.nodes.pds.dataDictionary.classDictionary;
        for (var c = 0; c < classDict.length; c++) {
            var classDictEntry = classDict[c].class;
            if (classDictEntry.identifier === dataTypeId) {
                //  Get the Formation Rule from the Association List
                var associationList = classDictEntry.associationList;
                if (associationList !== undefined) {
                    for (var a = 0; a < associationList.length; a++) {
                        var association = associationList[a].association;
                        if (association.title === FORMATION_RULE_KEYWORD) {
                            //  Get the Formation Rule
                            var assocAttributeIdArray = association.attributeId;
                            if ((assocAttributeIdArray !== undefined) && (assocAttributeIdArray.length > 0)) {
                                var formationRuleId = assocAttributeIdArray[0];
                                //  Look up the Formation Rule in the Attribute Dictionary
                                var attrDict = g_jsonData.nodes.pds.dataDictionary.attributeDictionary;
                                for (var at = 0; at < attrDict.length; at++) {
                                    var attrDictEntry = attrDict[at].attribute;
                                    if (attrDictEntry.identifier === formationRuleId) {
                                        //  Get the formation rule desc.
                                        var permissibleValList = attrDictEntry.PermissibleValueList;
                                        if ((permissibleValList !== undefined) && (permissibleValList.length > 0)) {
                                            permissibleValMeaning = permissibleValList[0].PermissibleValue.valueMeaning;
                                        }
                                        break;  //  out of attrDict loop
                                    }
                                }
                            }
                            break;  //  out of associationList loop
                        }
                    }
                }
                break;  //  out of classDict loop
            }
        }
    }
    return permissibleValMeaning;
}
