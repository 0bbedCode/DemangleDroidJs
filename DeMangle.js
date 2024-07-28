let nums = "1234567890";
let alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
let specials = ["string", "uint", "int", "utf"];
let bts = ["8", "16", "32", "64"];

let badEnds = ["Ev", "Ei", "Em", "Im", "If", "Pb", "Ia", "Id", "Ii", "Ib", "Ih", "Ej", "Ea", "Fds", "Eb", "Il", "Ef", "Ic", "El", "Pi"];
//First check if it ends with a Cap then a Lower case combo then Clean that out
//For ones like "EmmPb" hmm
//Typically at ends so we can split string by the "." then clean out ends ?
//Was used no longer at use
//let hidChars = ["_Hidl_", "_hidl_", "hidl_", "Hidl_", "_hidl", "_Hidl", ".hidl.", ".Hidl.", ".hidl", ".Hidl", "hidl.", "Hidl.", "hidl", "Hidl"];

function demangle(mangledName) {
    function clearArray(array) {
        while (array.length > 0) {
            array.pop();
        }
    }

    function isMangled(str) { return str.startsWith("_Z"); }
    function isNumber(ch) { return nums.includes(ch); }
    function isAlpha(ch) {  return alpha.includes(ch);  }
    //function hasSpecial(str) { return specials.includes(str.toLowerCase()); }

    function hasSpecial(str) {
        let low = str.toLowerCase();
        for (let s of specials) {
            if (low.endsWith(s)) {
                return true;
            }
        }
        return false;
    }

    function isLower(ch) {  return ch === ch.toLowerCase() && ch !== ch.toUpperCase(); }
    function isUpper(ch) {  return !isLower(ch);   }
    function isBadChar(ch) { return ch === "_" || isNumber(ch); }

    function pushCurrent(part, pts) {
        let begCaps = 0;
        if (part !== "" && part.length > 1) {
            for (let i = 0; i < part.length; i++) {
                let ch = part.charAt(i);
                if (isUpper(ch)) {
                    begCaps++;
                } else {
                    break;
                }
            }

            if (begCaps > 2)
                return;

            //check between 3 & 4 we dont want like "IPb" "IPbc"
            if (begCaps === 2 && (part.length === 3 || part.length === 4))
                return;

            pts.push(part);
        }
    }

    function pushToParts(part, pts) {
        if (pts.length === 0) {
            if (part !== "" && part.length > 4) {
                //for beg part we want to try to exceed 4 Chars ?
                pts.push(part);
                return hasSpecial(part);
            }
        } else {
            if (part !== "" && part.length > 1) {
                if (part.length === 2) {
                    let chr = part.charAt(0);
                    if (isUpper(chr)) {
                        let last = pts.pop();
                        pts.push(last + part);
                        return;
                    }
                }
                pts.push(part);
                return hasSpecial(part);
            }
        }

        return false;
    }

    if (!isMangled(mangledName))
        return mangledName;

    mangledName = mangledName.replace("_Z", "");

    let parts = [];
    //If Capital expect to follow with non caps if not its part of the mangling
    //Find Capitals follow
    //if all lower case that can be possible

    let current = "";
    let currentParts = [];
    let expectLower = false;

    let lastWasCap = false;

    let lastWasSpecial = false;
    let lastEndedInNum = false;
    let extNums = "";

    for (let i = 0; i < mangledName.length; i++) {
        //If caps next couple chars should follow as lower Case
        let ch = mangledName.charAt(i);

        if (isAlpha(ch)) {
            if (lastEndedInNum && current === "" && parts.length > 0) {
                let last = parts.pop();
                current = last;
                lastEndedInNum = false;
            }

            if (isUpper(ch)) {
                if (!expectLower)
                    expectLower = true;

                if (current !== "") {
                    if (!lastWasCap) {
                        //check if last was upper encase "IBinder" "IB"
                        //currentParts.push(current);
                        pushCurrent(current, currentParts);
                        current = "";
                    }
                }

                current = current + ch;
                if (!lastWasCap)
                    lastWasCap = true;

            } else {
                if (lastWasCap)
                    lastWasCap = false;

                if (expectLower)
                    expectLower = false;

                current = current + ch;
            }
        } else {
            if (isBadChar(ch)) {
                if (lastEndedInNum)
                    lastEndedInNum = false;

                if (expectLower) {
                    //ignore current part as it was like "BpBinderEL1" (we want to ignore "EL")
                    //We should at this point append parts to the main part
                    //It should look like parts = [ "Bp", "Binder" ] not including "EL"
                    expectLower = false;
                    if (current !== "")
                        current = "";

                    if (currentParts.length > 0) {
                        let pt = currentParts.join('');
                        clearArray(currentParts);
                        if (pt !== "") {
                            pushToParts(pt, parts);
                            //parts.push(pt);
                        }
                    }
                } else {
                    if (ch === "_" && current !== "") {
                        let lastChar = current.charAt(current.length - 1);
                        if (isAlpha(lastChar) && isLower(lastChar)) {
                            if (mangledName.length - 1 > i) {
                                let nextChar = mangledName.charAt(i + 1);
                                if (isAlpha(nextChar) && isLower(nextChar)) {
                                    current = current + "_";
                                    continue;
                                }
                            }
                        }
                    }

                    //It dosnt expect a lower but had a Number or Underscore
                    //BpBinder12_ or BpBinder_44
                    if (current !== "") {
                        //currentParts.push(current);
                        pushCurrent(current, currentParts);
                        current = "";
                        lastWasSpecial = false;
                    }

                    if (currentParts.length > 0) {
                        let pt = currentParts.join('');
                        clearArray(currentParts);
                        if (pt !== "") {
                            lastWasSpecial = pushToParts(pt, parts);
                            //parts.push(pt);
                        }
                    }

                    if (lastWasSpecial && isNumber(ch)) {
                        extNums = extNums + ch;
                        if (bts.includes(extNums)) {
                            let last = parts.pop();
                            parts.push(last + extNums);
                            extNums = "";
                            lastWasSpecial = false;
                            lastEndedInNum = true;
                        }
                    }
                }
            }
        }
    }

    if (!lastWasCap && current.length !== "") {
        //currentParts.push(current);
        pushCurrent(current, currentParts);
        current = "";
    }

    if (currentParts.length > 0) {
        let pt = currentParts.join('');
        clearArray(currentParts);
        if (pt !== "") {
            pushToParts(pt, parts);
        }
    }

    let finalParts = [];
    for (let p of parts) {
        if (p.length < 6) {
            let fIx = -1;
            for (let b of badEnds) {
                let ix = p.indexOf(b);
                if (ix > -1) {
                    if (ix < fIx || fIx === -1)
                        fIx = ix;
                    if (fIx === 0)
                        break;
                }
            }

            let tStr = p;
            if (fIx > -1) {
                if (fIx === 0)
                    continue;
                tStr = p.slice(0, fIx);
                if (tStr.length < 2)
                    continue;
            }

            let allSameChars = true;
            let c = tStr.charAt(0);
            for (let ic = 1; ic < tStr.length; ic++) {
                let chr = tStr.charAt(ic);
                if (chr !== c) {
                    allSameChars = false;
                    break;
                }
            }

            if (allSameChars)
                continue;

            finalParts.push(tStr);
        } else {
            let fIx = 0;
            for (let b of badEnds) {
                let ix = p.indexOf(b);
                if (ix > 2) {
                    //so it was found
                    //now who has the "lowest" index
                    if (fIx === 0) {
                        fIx = ix;
                    } else if (fIx > ix) {
                        fIx = ix;
                        if (ix === 3)
                            break;
                    }
                }
            }
            if (fIx > 2) finalParts.push(p.slice(0, fIx));
            else finalParts.push(p);
        }
    }

    if (finalParts.length > 0)
        return finalParts.join('.')
            .replaceAll("Hidl", "")
            .replaceAll("hidl", "")
            .replaceAll("..", ".")
            .replaceAll("__", "_")
            .replaceAll("._", ".")
            .replaceAll("_.", ".");

    return mangledName;
}
//Will later add function to get just class Name and Function instead of Name Space what not

//Below is Example code it is not needed you can delete
//let syms = ["_ZNK7android6Parcel17readUtf8FromUtf16EPNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE", "_ZN7android6Parcel17writeDoubleVectorERKNSt3__16vectorIdNS1_9allocatorIdEEEE", "_ZNK7android6Parcel18compareDataInRangeEmRKS0_mmPi", "_ZNK7android6Parcel25debugReadAllStrongBindersEv", "_ZNK7android6Parcel9readInt32EPi", "_ZNK7android6Parcel9readInt64EPl", "_ZNK7android6Parcel16readNativeHandleEv", "_ZNK7android6Parcel14readByteVectorEPNSt3__18optionalINS1_6vectorIaNS1_9allocatorIaEEEEEE", "_ZNK7android6Parcel10readUint64EPm", "_ZNK7android6Parcel10readUint32EPj", "_ZN7android6Parcel9initStateEv", "_ZN7android6Parcel16writeUtf8AsUtf16ERKNSt3__110unique_ptrINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS1_14default_deleteIS8_EEEE", "_ZNK7android6Parcel17getBlobAshmemSizeEv", "_ZNK7android6Parcel12readString16Ev", "_ZN7android6ParcelD1Ev", "_ZNK7android6Parcel8allowFdsEv", "_ZNK7android6Parcel10readDoubleEPd", "_ZNK7android6Parcel14readByteVectorEPNSt3__16vectorIhNS1_9allocatorIhEEEE", "_ZNK7android6Parcel15readInt64VectorEPNSt3__16vectorIlNS1_9allocatorIlEEEE", "_ZN7android6Parcel9writeBoolEb", "_ZN7android6ParcelC2Ev", "_ZNK7android6Parcel24readNullableStrongBinderEPNS_2spINS_7IBinderEEE", "_ZN7android6Parcel13writeUnpaddedEPKvm", "_ZN7android6Parcel11writeDoubleEd", "_ZN7android6Parcel7setDataEPKhm", "_ZNK7android6Parcel11readPointerEPm", "_ZNK7android6Parcel16enforceInterfaceERKNS_8String16EPNS_14IPCThreadStateE", "_ZN7android6Parcel14acquireObjectsEv", "_ZNK7android6Parcel14readByteVectorEPNSt3__110unique_ptrINS1_6vectorIhNS1_9allocatorIhEEEENS1_14default_deleteIS6_EEEE", "_ZN7android6Parcel17writeStrongBinderERKNS_2spINS_7IBinderEEE", "_ZN7android6Parcel4BlobD1Ev", "_ZNK7android6Parcel15readInt64VectorEPNSt3__18optionalINS1_6vectorIlNS1_9allocatorIlEEEEEE", "_ZNK7android6Parcel18readFileDescriptorEv", "_ZNK7android6Parcel18readString16VectorEPNSt3__110unique_ptrINS1_6vectorINS2_INS_8String16ENS1_14default_deleteIS4_EEEENS1_9allocatorIS7_EEEENS5_ISA_EEEE", "_ZNK7android6Parcel18readString8InplaceEPm", "_ZN7android6Parcel4Blob7releaseEv", "_ZN7android6Parcel4BlobC2Ev", "_ZN7android6Parcel28writeUtf8VectorAsUtf16VectorERKNSt3__110unique_ptrINS1_6vectorINS2_INS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS1_14default_deleteIS9_EEEENS7_ISC_EEEENSA_ISE_EEEE", "_ZN7android6Parcel17writeUint64VectorERKNSt3__18optionalINS1_6vectorImNS1_9allocatorImEEEEEE", "_ZNK7android6Parcel11readInplaceEm", "_ZN7android6Parcel19writeFileDescriptorEib", "_ZNK7android6Parcel4dataEv", "_ZNK7android6Parcel12dataCapacityEv", "_ZNK7android6Parcel9dataAvailEv", "_ZNK7android6Parcel9readInt64Ev", "_ZNK7android6Parcel10readDoubleEv", "_ZN7android6Parcel17writeNativeHandleEPK13native_handle", "_ZN7android6Parcel20closeFileDescriptorsEv", "_ZN7android6Parcel12writeString8EPKcm", "_ZN7android6Parcel31writeUniqueFileDescriptorVectorERKNSt3__110unique_ptrINS1_6vectorINS_4base14unique_fd_implINS4_13DefaultCloserEEENS1_9allocatorIS7_EEEENS1_14default_deleteISA_EEEE", "_ZNK7android6Parcel8readBlobEmPNS0_12ReadableBlobE", "_ZN7android6Parcel31writeUniqueFileDescriptorVectorERKNSt3__16vectorINS_4base14unique_fd_implINS3_13DefaultCloserEEENS1_9allocatorIS6_EEEE", "_ZNK7android6Parcel12readString16EPNS_8String16E", "_ZNK7android6Parcel27debugReadAllFileDescriptorsEv", "_ZN7android6Parcel15writeCharVectorERKNSt3__18optionalINS1_6vectorIDsNS1_9allocatorIDsEEEEEE", "_ZNK7android6Parcel16readStrongBinderEv", "_ZN7android6Parcel12writeString8ERKNS_7String8E", "_ZN7android6Parcel35writeDupImmutableBlobFileDescriptorEi", "_ZN7android6Parcel14freeDataNoInitEv", "_ZN7android6Parcel19writeString16VectorERKNSt3__16vectorINS_8String16ENS1_9allocatorIS3_EEEE", "_ZN7android6Parcel16writeUtf8AsUtf16ERKNSt3__18optionalINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEEE", "_ZN7android6Parcel17writeUint64VectorERKNSt3__16vectorImNS1_9allocatorImEEEE", "_ZNK7android6Parcel16readStrongBinderEPNS_2spINS_7IBinderEEE", "_ZN7android6Parcel23writeStrongBinderVectorERKNSt3__18optionalINS1_6vectorINS_2spINS_7IBinderEEENS1_9allocatorIS6_EEEEEE", "_ZN7android6Parcel5writeERKNS0_26FlattenableHelperInterfaceE", "_ZNK7android6Parcel4readERNS0_26FlattenableHelperInterfaceE", "_ZN7android6Parcel31writeUniqueFileDescriptorVectorERKNSt3__18optionalINS1_6vectorINS_4base14unique_fd_implINS4_13DefaultCloserEEENS1_9allocatorIS7_EEEEEE", "_ZNK7android6Parcel25hasFileDescriptorsInRangeEmmPb", "_ZN7android6Parcel28writeDupParcelFileDescriptorEi", "_ZN7android6Parcel4Blob4initEiPvmb", "_ZNK7android6Parcel22readStrongBinderVectorEPNSt3__18optionalINS1_6vectorINS_2spINS_7IBinderEEENS1_9allocatorIS6_EEEEEE", "_ZNK7android6Parcel16readUint64VectorEPNSt3__18optionalINS1_6vectorImNS1_9allocatorImEEEEEE", "_ZNK7android6Parcel19readString16InplaceEPm", "_ZNK7android6Parcel15readFloatVectorEPNSt3__18optionalINS1_6vectorIfNS1_9allocatorIfEEEEEE", "_ZNK7android6Parcel14readCharVectorEPNSt3__110unique_ptrINS1_6vectorIDsNS1_9allocatorIDsEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel9readInt32Ev", "_ZNK7android6Parcel29readUtf8VectorFromUtf16VectorEPNSt3__110unique_ptrINS1_6vectorINS2_INS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS1_14default_deleteIS9_EEEENS7_ISC_EEEENSA_ISE_EEEE", "_ZN7android6Parcel13flattenBinderERKNS_2spINS_7IBinderEEE", "_ZN7android6Parcel17writeDoubleVectorERKNSt3__18optionalINS1_6vectorIdNS1_9allocatorIdEEEEEE", "_ZNK7android6Parcel14readByteVectorEPNSt3__16vectorIaNS1_9allocatorIaEEEE", "_ZN7android6Parcel14releaseObjectsEv", "_ZN7android6Parcel19writeString16VectorERKNSt3__110unique_ptrINS1_6vectorINS2_INS_8String16ENS1_14default_deleteIS4_EEEENS1_9allocatorIS7_EEEENS5_ISA_EEEE", "_ZN7android6Parcel12restartWriteEm", "_ZNK7android6Parcel15unflattenBinderEPNS_2spINS_7IBinderEEE", "_ZN7android6Parcel10writeFloatEf", "_ZN7android6Parcel12pushAllowFdsEb", "_ZNK7android6Parcel8readBoolEPb", "_ZNK7android6Parcel30readUniqueFileDescriptorVectorEPNSt3__110unique_ptrINS1_6vectorINS_4base14unique_fd_implINS4_13DefaultCloserEEENS1_9allocatorIS7_EEEENS1_14default_deleteISA_EEEE", "_ZNK7android6Parcel18readString16VectorEPNSt3__16vectorINS_8String16ENS1_9allocatorIS3_EEEE", "_ZNK7android6Parcel16validateReadDataEm", "_ZN7android6Parcel10markForRpcERKNS_2spINS_10RpcSessionEEE", "_ZNK7android6Parcel16readUint64VectorEPNSt3__110unique_ptrINS1_6vectorImNS1_9allocatorImEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel8readCharEv", "_ZNK7android6Parcel11ipcDataSizeEv", "_ZNK7android6Parcel16readStrongBinderINS_2os16IServiceCallbackEEEiPNS_2spIT_EE", "_ZN7android6Parcel15writeByteVectorERKNSt3__110unique_ptrINS1_6vectorIhNS1_9allocatorIhEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel30readUniqueFileDescriptorVectorEPNSt3__18optionalINS1_6vectorINS_4base14unique_fd_implINS4_13DefaultCloserEEENS1_9allocatorIS7_EEEEEE", "_ZN7android6Parcel12writeCStringEPKc", "_ZNK7android6Parcel11readString8EPNS_7String8E", "_ZNK7android6Parcel11readPointerEv", "_ZN7android6Parcel13writeString16ERKNSt3__110unique_ptrINS_8String16ENS1_14default_deleteIS3_EEEE", "_ZN7android6Parcel15writeByteVectorERKNSt3__16vectorIhNS1_9allocatorIhEEEE", "_ZN7android6Parcel11finishWriteEm", "_ZN7android6Parcel13writeString16EPKDsm", "_ZNK7android6Parcel8readByteEv", "_ZN7android6Parcel16writeInt32VectorERKNSt3__110unique_ptrINS1_6vectorIiNS1_9allocatorIiEEEENS1_14default_deleteIS6_EEEE", "_ZN7android6Parcel23writeStrongBinderVectorERKNSt3__16vectorINS_2spINS_7IBinderEEENS1_9allocatorIS5_EEEE", "_ZN7android6Parcel15writeBoolVectorERKNSt3__16vectorIbNS1_9allocatorIbEEEE", "_ZN7android6Parcel15writeCharVectorERKNSt3__16vectorIDsNS1_9allocatorIDsEEEE", "_ZNK7android6Parcel15readInt32VectorEPNSt3__16vectorIiNS1_9allocatorIiEEEE", "_ZNK7android6Parcel15setDataPositionEm", "_ZNK7android6Parcel14readBoolVectorEPNSt3__110unique_ptrINS1_6vectorIbNS1_9allocatorIbEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel15readInt32VectorEPNSt3__110unique_ptrINS1_6vectorIiNS1_9allocatorIiEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel5printERNS_10TextOutputEj", "_ZN7android6ParcelC1Ev", "_ZNK7android6Parcel14readCharVectorEPNSt3__16vectorIDsNS1_9allocatorIDsEEEE", "_ZNK7android6Parcel26readOutVectorSizeWithCheckEmPi", "_ZNK7android6Parcel14readByteVectorEPNSt3__110unique_ptrINS1_6vectorIaNS1_9allocatorIaEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel14readBoolVectorEPNSt3__18optionalINS1_6vectorIbNS1_9allocatorIbEEEEEE", "_ZN7android6Parcel25writeParcelFileDescriptorEib", "_ZN7android6Parcel26writeRawNullableParcelableEPKNS_10ParcelableE", "_ZNK7android6Parcel29readUtf8VectorFromUtf16VectorEPNSt3__18optionalINS1_6vectorINS2_INS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEEENS7_ISA_EEEEEE", "_ZNK7android6Parcel24readCallingWorkSourceUidEv", "_ZNK7android6Parcel17readUtf8FromUtf16EPNSt3__18optionalINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEEE", "_ZNK7android6Parcel15readInt64VectorEPNSt3__110unique_ptrINS1_6vectorIlNS1_9allocatorIlEEEENS1_14default_deleteIS6_EEEE", "_ZN7android6Parcel15writeByteVectorERKNSt3__18optionalINS1_6vectorIhNS1_9allocatorIhEEEEEE", "_ZN7android6Parcel16writeInt64VectorERKNSt3__110unique_ptrINS1_6vectorIlNS1_9allocatorIlEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel16readDoubleVectorEPNSt3__16vectorIdNS1_9allocatorIdEEEE", "_ZN7android6Parcel11compareDataERKS0_", "_ZNK7android6Parcel12readString16EPNSt3__18optionalINS_8String16EEE", "_ZNK7android6Parcel22readStrongBinderVectorEPNSt3__16vectorINS_2spINS_7IBinderEEENS1_9allocatorIS5_EEEE", "_ZNK7android6Parcel4readEPvm", "_ZNK7android6Parcel14readCharVectorEPNSt3__18optionalINS1_6vectorIDsNS1_9allocatorIDsEEEEEE", "_ZNK7android6Parcel8readBoolEv", "_ZN7android6Parcel8setErrorEi", "_ZNK7android6Parcel10scanForFdsEv", "_ZN7android6Parcel16writeInt64VectorERKNSt3__16vectorIlNS1_9allocatorIlEEEE", "_ZNK7android6Parcel8readByteEPa", "_ZNK7android6Parcel22readStrongBinderVectorEPNSt3__110unique_ptrINS1_6vectorINS_2spINS_7IBinderEEENS1_9allocatorIS6_EEEENS1_14default_deleteIS9_EEEE", "_ZN7android6Parcel15writeInt32ArrayEmPKi", "_ZN7android6Parcel4BlobC1Ev", "_ZNK7android6Parcel37updateWorkSourceRequestHeaderPositionEv", "_ZN7android6Parcel15setDataCapacityEm", "_ZNK7android6Parcel12objectsCountEv", "_ZNK7android6Parcel16readDoubleVectorEPNSt3__18optionalINS1_6vectorIdNS1_9allocatorIdEEEEEE", "_ZNK7android6Parcel8isForRpcEv", "_ZNK7android6Parcel29readUtf8VectorFromUtf16VectorEPNSt3__16vectorINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS6_IS8_EEEE", "_ZN7android6Parcel11setDataSizeEm", "_ZNK7android6Parcel18hasFileDescriptorsEv", "_ZNK7android6Parcel16readStrongBinderINS_2os15IClientCallbackEEEiPNS_2spIT_EE", "_ZN7android6Parcel12writeInplaceEm", "_ZN7android6Parcel19writeString16VectorERKNSt3__18optionalINS1_6vectorINS2_INS_8String16EEENS1_9allocatorIS5_EEEEEE", "_ZN7android6Parcel19writeInterfaceTokenERKNS_8String16E", "_ZNK7android6Parcel21finishUnflattenBinderERKNS_2spINS_7IBinderEEEPS3_", "_ZNK7android6Parcel18readString16VectorEPNSt3__18optionalINS1_6vectorINS2_INS_8String16EEENS1_9allocatorIS5_EEEEEE", "_ZNK7android6Parcel24readParcelFileDescriptorEv", "_ZNK7android6Parcel13markSensitiveEv", "_ZN7android6Parcel16writeInt64VectorERKNSt3__18optionalINS1_6vectorIlNS1_9allocatorIlEEEEEE", "_ZN7android6Parcel14writeByteArrayEmPKh", "_ZN7android6Parcel13markForBinderERKNS_2spINS_7IBinderEEE", "_ZNK7android6Parcel10ipcObjectsEv", "_ZNK7android6Parcel11readString8Ev", "_ZN7android6ParcelD2Ev", "_ZN7android6Parcel15writeBoolVectorERKNSt3__18optionalINS1_6vectorIbNS1_9allocatorIbEEEEEE", "_ZN7android6Parcel15writeBoolVectorERKNSt3__110unique_ptrINS1_6vectorIbNS1_9allocatorIbEEEENS1_14default_deleteIS6_EEEE", "_ZN7android6Parcel28writeUtf8VectorAsUtf16VectorERKNSt3__16vectorINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS6_IS8_EEEE", "_ZN7android6Parcel16writeFloatVectorERKNSt3__16vectorIfNS1_9allocatorIfEEEE", "_ZNK7android6Parcel16enforceInterfaceEPKDsmPNS_14IPCThreadStateE", "_ZNK7android6Parcel9readFloatEv", "_ZNK7android6Parcel24readUniqueFileDescriptorEPNS_4base14unique_fd_implINS1_13DefaultCloserEEE", "_ZN7android6Parcel15writeByteVectorERKNSt3__16vectorIaNS1_9allocatorIaEEEE", "_ZN7android6Parcel16writeFloatVectorERKNSt3__18optionalINS1_6vectorIfNS1_9allocatorIfEEEEEE", "_ZNK7android6Parcel14readParcelableEPNS_10ParcelableE", "_ZNK7android6Parcel8readCharEPDs", "_ZNK7android6Parcel11readCStringEv", "_ZN7android6Parcel8growDataEm", "_ZN7android6Parcel19ipcSetDataReferenceEPKhmPKymPFvPS0_S2_mS4_mE", "_ZN7android6Parcel11writeObjectERK18flat_binder_objectb", "_ZN7android6Parcel4Blob5clearEv", "_ZNK7android6Parcel14readByteVectorEPNSt3__18optionalINS1_6vectorIhNS1_9allocatorIhEEEEEE", "_ZN7android6Parcel4BlobD2Ev", "_ZNK7android6Parcel18enforceNoDataAvailEv", "_ZNK7android6Parcel15readInt32VectorEPNSt3__18optionalINS1_6vectorIiNS1_9allocatorIiEEEEEE", "_ZN7android6Parcel9writeCharEDs", "_ZN7android6Parcel28writeUtf8VectorAsUtf16VectorERKNSt3__18optionalINS1_6vectorINS2_INS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEEENS7_ISA_EEEEEE", "_ZNK7android6Parcel10readObjectEb", "_ZN7android6Parcel18getGlobalAllocSizeEv", "_ZNK7android6Parcel12dataPositionEv", "_ZN7android6Parcel11writeUint64Em", "_ZN7android6Parcel22writeDupFileDescriptorEi", "_ZN7android6Parcel15writeByteVectorERKNSt3__110unique_ptrINS1_6vectorIaNS1_9allocatorIaEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel15ipcObjectsCountEv", "_ZN7android6Parcel16writeFloatVectorERKNSt3__110unique_ptrINS1_6vectorIfNS1_9allocatorIfEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel30readUniqueParcelFileDescriptorEPNS_4base14unique_fd_implINS1_13DefaultCloserEEE", "_ZN7android6Parcel10appendFromEPKS0_mm", "_ZNK7android6Parcel17readUtf8FromUtf16EPNSt3__110unique_ptrINS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEENS1_14default_deleteIS8_EEEE", "_ZNK7android6Parcel8dataSizeEv", "_ZN7android6Parcel23writeStrongBinderVectorERKNSt3__110unique_ptrINS1_6vectorINS_2spINS_7IBinderEEENS1_9allocatorIS6_EEEENS1_14default_deleteIS9_EEEE", "_ZN7android6Parcel13writeString16ERKNSt3__18optionalINS_8String16EEE", "_ZN7android6Parcel15writeByteVectorERKNSt3__18optionalINS1_6vectorIaNS1_9allocatorIaEEEEEE", "_ZNK7android6Parcel10readUint64Ev", "_ZN7android6Parcel12writePointerEm", "_ZN7android6Parcel13continueWriteEm", "_ZNK7android6Parcel17readExceptionCodeEv", "_ZNK7android6Parcel15readFloatVectorEPNSt3__16vectorIfNS1_9allocatorIfEEEE", "_ZNK7android6Parcel14readBoolVectorEPNSt3__16vectorIbNS1_9allocatorIbEEEE", "_ZN7android6Parcel16writeNoExceptionEv", "_ZN7android6Parcel8freeDataEv", "_ZN7android6Parcel10writeInt64El", "_ZN7android6Parcel9writeBlobEmbPNS0_12WritableBlobE", "_ZN7android6Parcel11writeUint32Ej", "_ZN7android6Parcel15writeCharVectorERKNSt3__110unique_ptrINS1_6vectorIDsNS1_9allocatorIDsEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel14checkInterfaceEPNS_7IBinderE", "_ZN7android6Parcel17writeDoubleVectorERKNSt3__110unique_ptrINS1_6vectorIdNS1_9allocatorIdEEEENS1_14default_deleteIS6_EEEE", "_ZNK7android6Parcel9readFloatEPf", "_ZNK7android6Parcel10errorCheckEv", "_ZNK7android6Parcel12readString16EPNSt3__110unique_ptrINS_8String16ENS1_14default_deleteIS3_EEEE", "_ZN7android6Parcel15restoreAllowFdsEb", "_ZN7android6Parcel5writeEPKvm", "_ZNK7android6Parcel15readFloatVectorEPNSt3__110unique_ptrINS1_6vectorIfNS1_9allocatorIfEEEENS1_14default_deleteIS6_EEEE", "_ZN7android6Parcel16writeUtf8AsUtf16ERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE", "_ZNK7android6Parcel16readUint64VectorEPNSt3__16vectorImNS1_9allocatorImEEEE", "_ZNK7android6Parcel16readDoubleVectorEPNSt3__110unique_ptrINS1_6vectorIdNS1_9allocatorIdEEEENS1_14default_deleteIS6_EEEE", "_ZN7android6Parcel27replaceCallingWorkSourceUidEj", "_ZN7android6Parcel13writeString16ERKNS_8String16E", "_ZNK7android6Parcel30readUniqueFileDescriptorVectorEPNSt3__16vectorINS_4base14unique_fd_implINS3_13DefaultCloserEEENS1_9allocatorIS6_EEEE", "_ZN7android6Parcel19writeInterfaceTokenEPKDsm", "_ZN7android6Parcel15writeParcelableERKNS_10ParcelableE", "_ZN7android6Parcel25writeUniqueFileDescriptorERKNS_4base14unique_fd_implINS1_13DefaultCloserEEE", "_ZNK7android6Parcel10readUint32Ev", "_ZN7android6Parcel9writeByteEa", "_ZN7android6Parcel10writeInt32Ei", "_ZN7android6Parcel19getGlobalAllocCountEv", "_ZNK7android6Parcel17getOpenAshmemSizeEv", "_ZN7android6Parcel16writeInt32VectorERKNSt3__16vectorIiNS1_9allocatorIiEEEE", "_ZN7android6Parcel19finishFlattenBinderERKNS_2spINS_7IBinderEEE", "_ZN7android6Parcel16writeInt32VectorERKNSt3__18optionalINS1_6vectorIiNS1_9allocatorIiEEEEEE", "_ZN7android6Parcel17writeUint64VectorERKNSt3__110unique_ptrINS1_6vectorImNS1_9allocatorImEEEENS1_14default_deleteIS6_EEEE", "Export: _ZN7android8BpBinder8transactEjRKNS_6ParcelEPS1_j"];
let syms = ["_ZN7android13SensorManager20waitForSensorServiceEPNS_2spINS_13ISensorServerEEE", "_ZN7android19NativeSensorService33unregisterProximityActiveListenerEv", "_ZTTN7android19NativeSensorService31ProximityActiveListenerDelegateE", "_ZN7android19NativeSensorService31ProximityActiveListenerDelegateD1Ev", "_ZTv0_n24_N7android19NativeSensorService31ProximityActiveListenerDelegateD1Ev", "_ZTVN7android19NativeSensorService31ProximityActiveListenerDelegateE", "_ZN7android19NativeSensorService31ProximityActiveListenerDelegateC1EP7_JNIEnvP8_jobject", "_ZN7android19NativeSensorService31ProximityActiveListenerDelegateD2Ev", "_ZN7android44register_android_server_sensor_SensorServiceEP7_JavaVMP7_JNIEnv", "_ZTCN7android19NativeSensorService31ProximityActiveListenerDelegateE0_NS_13SensorService23ProximityActiveListenerE", "_ZN7android19NativeSensorServiceC1EP7_JNIEnvP8_jobject", "_ZN7android19NativeSensorServiceC2EP7_JNIEnvP8_jobject", "_ZN7android19NativeSensorService31registerProximityActiveListenerEv", "_ZN7android19NativeSensorService31ProximityActiveListenerDelegateD0Ev", "_ZN7android19NativeSensorService31ProximityActiveListenerDelegateC2EP7_JNIEnvP8_jobject", "_ZTv0_n24_N7android19NativeSensorService31ProximityActiveListenerDelegateD0Ev", "_ZN7android19NativeSensorService31ProximityActiveListenerDelegate17onProximityActiveEb", "_ZN7android13SensorServiceC2Ev", "_ZN7android13SensorService26addProximityActiveListenerERKNS_2spINS0_23ProximityActiveListenerEEE", "_ZN7android13SensorServiceC1Ev", "_ZN7android13SensorService29removeProximityActiveListenerERKNS_2spINS0_23ProximityActiveListenerEEE", "_ZN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelD1Ev", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManagerC2EP7_JavaVM", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager13getSensorListENSt3__18functionIFvRKNS_8hardware8hidl_vecINS7_7sensors4V1_010SensorInfoEEENS2_6ResultEEEE", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager9getLooperEv", "_ZN7android10frameworks13sensorservice4V1_014implementation10EventQueue15onLastStrongRefEPKv", "_ZN7android10frameworks13sensorservice4V1_014implementation10EventQueue12enableSensorEiil", "_ZN7android10frameworks13sensorservice4V1_014implementation10EventQueueC1ENS_2spINS2_19IEventQueueCallbackEEENS5_INS_6LooperEEENS5_INS_16SensorEventQueueEEE", "_ZTCN7android10frameworks13sensorservice4V1_014implementation13SensorManagerE0_NS_4hidl4base4V1_05IBaseE", "_ZTv0_n40_N7android10frameworks13sensorservice4V1_014implementation10EventQueue15onLastStrongRefEPKv", "_ZN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelD0Ev", "_ZN7android10frameworks13sensorservice4V1_014implementation13convertResultEi", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelD1Ev", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManagerD2Ev", "_ZTVN7android10frameworks13sensorservice4V1_014implementation10EventQueueE", "_ZN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannel9configureEiNS_8hardware7sensors4V1_09RateLevelENSt3__18functionIFviNS2_6ResultEEEE", "_ZTCN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelE0_NS2_20IDirectReportChannelE", "_ZN7android10frameworks13sensorservice4V1_014implementation10EventQueue13disableSensorEi", "_ZTCN7android10frameworks13sensorservice4V1_014implementation10EventQueueE0_NS2_11IEventQueueE", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager25createAshmemDirectChannelERKNS_8hardware11hidl_memoryEmNSt3__18functionIFvRKNS_2spINS2_20IDirectReportChannelEEENS2_6ResultEEEE", "_ZTTN7android10frameworks13sensorservice4V1_014implementation10EventQueueE", "_ZN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelC2ERNS_13SensorManagerEi", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelD0Ev", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManagerC1EP7_JavaVM", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManagerD1Ev", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_014implementation13SensorManagerD1Ev", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager18getInternalManagerEv", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager26createGrallocDirectChannelERKNS_8hardware11hidl_handleEmNSt3__18functionIFvRKNS_2spINS2_20IDirectReportChannelEEENS2_6ResultEEEE", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager16createEventQueueERKNS_2spINS2_19IEventQueueCallbackEEENSt3__18functionIFvRKNS5_INS2_11IEventQueueEEENS2_6ResultEEEE", "_ZTTN7android10frameworks13sensorservice4V1_014implementation13SensorManagerE", "_ZTCN7android10frameworks13sensorservice4V1_014implementation13SensorManagerE0_NS2_14ISensorManagerE", "_ZN7android10frameworks13sensorservice4V1_014implementation13convertSensorERKNS_6SensorE", "_ZTCN7android10frameworks13sensorservice4V1_014implementation10EventQueueE0_NS_4hidl4base4V1_05IBaseE", "_ZN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelD2Ev", "_ZTTN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelE", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManager16getDefaultSensorENS_8hardware7sensors4V1_010SensorTypeENSt3__18functionIFvRKNS7_10SensorInfoENS2_6ResultEEEE", "_ZN7android10frameworks13sensorservice4V1_014implementation12convertEventERK12ASensorEvent", "_ZN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelC1ERNS_13SensorManagerEi", "_ZN7android10frameworks13sensorservice4V1_014implementation13SensorManagerD0Ev", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_014implementation13SensorManagerD0Ev", "_ZTVN7android10frameworks13sensorservice4V1_014implementation13SensorManagerE", "_ZN7android10frameworks13sensorservice4V1_014implementation10EventQueueC2ENS_2spINS2_19IEventQueueCallbackEEENS5_INS_6LooperEEENS5_INS_16SensorEventQueueEEE", "_ZTVN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelE", "_ZTCN7android10frameworks13sensorservice4V1_014implementation19DirectReportChannelE0_NS_4hidl4base4V1_05IBaseE", "_ZThn32_N7android10frameworks13sensorservice4V1_023BnHwDirectReportChannelD0Ev", "_ZTVN7android10frameworks13sensorservice4V1_011IEventQueueE", "_ZTCN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackE0_NS_4hidl4base4V1_08BnHwBaseE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager22_hidl_createEventQueueEPNS_8hardware10IInterfaceEPNS4_7details16HidlInstrumentorERKNS_2spINS2_19IEventQueueCallbackEEENSt3__18functionIFvRKNSA_INS2_11IEventQueueEEENS2_6ResultEEEE", "_ZTCN7android10frameworks13sensorservice4V1_017BpHwSensorManagerE0_NS_4hidl4base4V1_05IBaseE", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue21notifySyspropsChangedEv", "_ZTCN7android10frameworks13sensorservice4V1_019IEventQueueCallbackE0_NS_4hidl4base4V1_05IBaseE", "_ZN7android10frameworks13sensorservice4V1_014ISensorManager19interfaceDescriptorENSt3__18functionIFvRKNS_8hardware11hidl_stringEEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager15onLastStrongRefEPKv", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager11linkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEEm", "_ZN7android10frameworks13sensorservice4V1_017BnHwSensorManagerC2ERKNS_2spINS2_14ISensorManagerEEE", "_ZN7android10frameworks13sensorservice4V1_023BpHwDirectReportChannelC2ERKNS_2spINS_8hardware7IBinderEEE", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback17registerAsServiceERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel19interfaceDescriptorENSt3__18functionIFvRKNS_8hardware11hidl_stringEEEE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel11linkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEEm", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue24registerForNotificationsERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEERKNS_2spINS_4hidl7manager4V1_020IServiceNotificationEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager26createGrallocDirectChannelERKNS_8hardware11hidl_handleEmNSt3__18functionIFvRKNS_2spINS2_20IDirectReportChannelEEENS2_6ResultEEEE", "_ZTCN7android10frameworks13sensorservice4V1_023BpHwDirectReportChannelE0_NS_8hardware11BpInterfaceINS2_20IDirectReportChannelEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager19_hidl_getSensorListEPNS_8hardware10IInterfaceEPNS4_7details16HidlInstrumentorENSt3__18functionIFvRKNS4_8hidl_vecINS4_7sensors4V1_010SensorInfoEEENS2_6ResultEEEE", "_ZN7android10frameworks13sensorservice4V1_014ISensorManager24registerForNotificationsERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEERKNS_2spINS_4hidl7manager4V1_020IServiceNotificationEEE", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue13unlinkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEE", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue10getServiceERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEb", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback12getHashChainENSt3__18functionIFvRKNS_8hardware8hidl_vecINS6_10hidl_arrayIhLm32EJEEEEEEEE", "_ZThn32_N7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackD0Ev", "_ZN7android10frameworks13sensorservice4V1_017BnHwSensorManagerC1ERKNS_2spINS2_14ISensorManagerEEE", "_ZN7android10frameworks13sensorservice4V1_023BpHwDirectReportChannelC1ERKNS_2spINS_8hardware7IBinderEEE", "_ZN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallback12getDebugInfoENSt3__18functionIFvRKNS_4hidl4base4V1_09DebugInfoEEEE", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback10getServiceERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEb", "_ZTCN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallbackE16_NS_8hardware11BpHwRefBaseE", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback14interfaceChainENSt3__18functionIFvRKNS_8hardware8hidl_vecINS6_11hidl_stringEEEEEE", "_ZN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallback13_hidl_onEventEPNS_4hidl4base4V1_08BnHwBaseERKNS_8hardware6ParcelEPSA_NSt3__18functionIFvRSA_EEE", "_ZTCN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackE0_NS_8hardware9BHwBinderE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager19interfaceDescriptorENSt3__18functionIFvRKNS_8hardware11hidl_stringEEEE", "_ZTTN7android10frameworks13sensorservice4V1_017BpHwSensorManagerE", "_ZTCN7android10frameworks13sensorservice4V1_014BpHwEventQueueE0_NS_4hidl4base4V1_05IBaseE", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback19interfaceDescriptorENSt3__18functionIFvRKNS_8hardware11hidl_stringEEEE", "_ZN7android10frameworks13sensorservice4V1_014ISensorManager4pingEv", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager14interfaceChainENSt3__18functionIFvRKNS_8hardware8hidl_vecINS6_11hidl_stringEEEEEE", "_ZN7android10frameworks13sensorservice4V1_017BnHwSensorManager10onTransactEjRKNS_8hardware6ParcelEPS5_jNSt3__18functionIFvRS5_EEE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel13unlinkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEE", "_ZTTN7android10frameworks13sensorservice4V1_014BnHwEventQueueE", "_ZThn16_N7android10frameworks13sensorservice4V1_023BpHwDirectReportChannel15onLastStrongRefEPKv", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue4pingEv", "_ZN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallbackC2ERKNS_2spINS_8hardware7IBinderEEE", "_ZN7android10frameworks13sensorservice4V1_014ISensorManager12getDebugInfoENSt3__18functionIFvRKNS_4hidl4base4V1_09DebugInfoEEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager21setHALInstrumentationEv", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_017BnHwSensorManagerD0Ev", "_ZTv0_n40_N7android10frameworks13sensorservice4V1_014BpHwEventQueue15onLastStrongRefEPKv", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue4pingEv", "_ZTCN7android10frameworks13sensorservice4V1_017BnHwSensorManagerE0_NS_8hardware7IBinderE", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_023BnHwDirectReportChannelD0Ev", "_ZTCN7android10frameworks13sensorservice4V1_014BpHwEventQueueE0_NS2_11IEventQueueE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager22_hidl_getDefaultSensorEPNS_8hardware10IInterfaceEPNS4_7details16HidlInstrumentorENS4_7sensors4V1_010SensorTypeENSt3__18functionIFvRKNSB_10SensorInfoENS2_6ResultEEEE", "_ZN7android10frameworks13sensorservice4V1_023BpHwDirectReportChannel21notifySyspropsChangedEv", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel10descriptorE", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue15onLastStrongRefEPKv", "_ZTCN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallbackE0_NS_8hardware11BpInterfaceINS2_19IEventQueueCallbackEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManagerC2ERKNS_2spINS_8hardware7IBinderEEE", "_ZTCN7android10frameworks13sensorservice4V1_017BpHwSensorManagerE16_NS_8hardware11BpHwRefBaseE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel8castFromERKNS_2spIS3_EEb", "_ZN7android10frameworks13sensorservice4V1_023BnHwDirectReportChannel15_hidl_configureEPNS_4hidl4base4V1_08BnHwBaseERKNS_8hardware6ParcelEPSA_NSt3__18functionIFvRSA_EEE", "_ZN7android10frameworks13sensorservice4V1_021BsDirectReportChannelC1ENS_2spINS2_20IDirectReportChannelEEE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel13tryGetServiceERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEb", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue13unlinkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager5debugERKNS_8hardware11hidl_handleERKNS4_8hidl_vecINS4_11hidl_stringEEE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel8castFromERKNS_2spINS_4hidl4base4V1_05IBaseEEEb", "_ZN7android10frameworks13sensorservice4V1_021BsDirectReportChannelC2ENS_2spINS2_20IDirectReportChannelEEE", "_ZTVN7android10frameworks13sensorservice4V1_020IDirectReportChannelE", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue8castFromERKNS_2spIS3_EEb", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue19interfaceDescriptorENSt3__18functionIFvRKNS_8hardware11hidl_stringEEEE", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue13tryGetServiceERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEb", "_ZTVN7android10frameworks13sensorservice4V1_014BpHwEventQueueE", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback11linkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEEm", "_ZN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallbackC1ERKNS_2spINS_8hardware7IBinderEEE", "_ZN7android10frameworks13sensorservice4V1_020BsEventQueueCallback13addOnewayTaskENSt3__18functionIFvvEEE", "_ZN7android10frameworks13sensorservice4V1_015BsSensorManagerC2ENS_2spINS2_14ISensorManagerEEE", "_ZTTN7android10frameworks13sensorservice4V1_023BnHwDirectReportChannelE", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback24registerForNotificationsERKNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEERKNS_2spINS_4hidl7manager4V1_020IServiceNotificationEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager25createAshmemDirectChannelERKNS_8hardware11hidl_memoryEmNSt3__18functionIFvRKNS_2spINS2_20IDirectReportChannelEEENS2_6ResultEEEE", "_ZTCN7android10frameworks13sensorservice4V1_020IDirectReportChannelE0_NS_4hidl4base4V1_05IBaseE", "_ZN7android10frameworks13sensorservice4V1_014ISensorManager14interfaceChainENSt3__18functionIFvRKNS_8hardware8hidl_vecINS6_11hidl_stringEEEEEE", "_ZN7android10frameworks13sensorservice4V1_014ISensorManager5debugERKNS_8hardware11hidl_handleERKNS4_8hidl_vecINS4_11hidl_stringEEE", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager12getDebugInfoENSt3__18functionIFvRKNS_4hidl4base4V1_09DebugInfoEEEE", "_ZN7android10frameworks13sensorservice4V1_023BnHwDirectReportChannel4pingEv", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue14interfaceChainENSt3__18functionIFvRKNS_8hardware8hidl_vecINS6_11hidl_stringEEEEEE", "_ZN7android10frameworks13sensorservice4V1_015BsSensorManager13addOnewayTaskENSt3__18functionIFvvEEE", "_ZN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackD0Ev", "_ZTTN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackE", "_ZThn32_N7android10frameworks13sensorservice4V1_017BnHwSensorManagerD1Ev", "_ZN7android10frameworks13sensorservice4V1_017BnHwSensorManager32_hidl_createGrallocDirectChannelEPNS_4hidl4base4V1_08BnHwBaseERKNS_8hardware6ParcelEPSA_NSt3__18functionIFvRSA_EEE", "_ZTCN7android10frameworks13sensorservice4V1_017BnHwSensorManagerE0_NS_8hardware9BHwBinderE", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel21notifySyspropsChangedEv", "_ZN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallback7onEventERKNS_8hardware7sensors4V1_05EventE", "_ZN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallback21notifySyspropsChangedEv", "_ZN7android10frameworks13sensorservice4V1_017BpHwSensorManager4pingEv", "_ZN7android10frameworks13sensorservice4V1_020IDirectReportChannel5debugERKNS_8hardware11hidl_handleERKNS4_8hidl_vecINS4_11hidl_stringEEE", "_ZN7android10frameworks13sensorservice4V1_023BnHwDirectReportChannelD1Ev", "_ZN7android10frameworks13sensorservice4V1_023BpHwDirectReportChannel9configureEiNS_8hardware7sensors4V1_09RateLevelENSt3__18functionIFviNS2_6ResultEEEE", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue11linkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEEm", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_014BnHwEventQueueD1Ev", "_ZN7android10frameworks13sensorservice4V1_019IEventQueueCallback8castFromERKNS_2spIS3_EEb", "_ZN7android10frameworks13sensorservice4V1_017BnHwSensorManagerD0Ev", "_ZTTN7android10frameworks13sensorservice4V1_017BnHwSensorManagerE", "_ZTTN7android10frameworks13sensorservice4V1_014ISensorManagerE", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueueC2ERKNS_2spINS_8hardware7IBinderEEE", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue21notifySyspropsChangedEv", "_ZN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackC1ERKNS_2spINS2_19IEventQueueCallbackEEE", "_ZN7android10frameworks13sensorservice4V1_020BsEventQueueCallbackC2ENS_2spINS2_19IEventQueueCallbackEEE", "_ZN7android10frameworks13sensorservice4V1_014BnHwEventQueueD0Ev", "_ZN7android10frameworks13sensorservice4V1_014BnHwEventQueue10onTransactEjRKNS_8hardware6ParcelEPS5_jNSt3__18functionIFvRS5_EEE", "_ZTv0_n40_N7android10frameworks13sensorservice4V1_022BpHwEventQueueCallback15onLastStrongRefEPKv", "_ZTv0_n24_N7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackD0Ev", "_ZTTN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallbackE", "_ZTVN7android10frameworks13sensorservice4V1_019IEventQueueCallbackE", "_ZN7android10frameworks13sensorservice4V1_017BnHwSensorManager12getDebugInfoENSt3__18functionIFvRKNS_4hidl4base4V1_09DebugInfoEEEE", "_ZN7android10frameworks13sensorservice4V1_023BpHwDirectReportChannel15onLastStrongRefEPKv", "_ZN7android10frameworks13sensorservice4V1_011IEventQueue19interfaceDescriptorENSt3__18functionIFvRKNS_8hardware11hidl_stringEEEE", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue12getDebugInfoENSt3__18functionIFvRKNS_4hidl4base4V1_09DebugInfoEEEE", "_ZN7android10frameworks13sensorservice4V1_014BpHwEventQueue11linkToDeathERKNS_2spINS_8hardware20hidl_death_recipientEEEm", "_ZN7android10frameworks13sensorservice4V1_022BpHwEventQueueCallback14interfaceChainENSt3__18functionIFvRKNS_8hardware8hidl_vecINS6_11hidl_stringEEEEEE", "_ZN7android10frameworks13sensorservice4V1_022BnHwEventQueueCallbackD2Ev", "_"];
for(let i = 0; i < syms.length; i++) {
    let s = syms[i];
    let d = demangle(s);
    console.log(d);
}

