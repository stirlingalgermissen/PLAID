<?php
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
 * @file Gets the XML from the database and outputs it to the front-end.
 *
 * Creation Date: 8/2/16
 *
 * @author Trevor Morse
 * @author Michael Kim
 * @author Stirling Algermissen
 */
require_once("interact_db.php");
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    header('Content-Type: text/plain');
    echo getLabelXML();
}