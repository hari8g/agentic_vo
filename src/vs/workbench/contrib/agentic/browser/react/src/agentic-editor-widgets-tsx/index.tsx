/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { AgenticCommandBarMain } from './AgenticCommandBar.js'
import { AgenticSelectionHelperMain } from './AgenticSelectionHelper.js'

export const mountAgenticCommandBar = mountFnGenerator(AgenticCommandBarMain)

export const mountAgenticSelectionHelper = mountFnGenerator(AgenticSelectionHelperMain)

