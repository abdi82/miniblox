// Banor till Lådknuffaren. Textformat: # = vägg, $ = låda, . = mål, @ = spelare, * = låda på mål, + = spelare på mål, mellanslag = golv.
// Alla banor är kontrollerade med en lösare (scratch-skript) så att de går att lösa.
export const LEVELS = [
  { name: 'Första knuffen', map: `
#####
#@$.#
#####` },
  { name: 'Runt hörnet', map: `
######
#@   #
# $  #
#  . #
######` },
  { name: 'Två lådor', map: `
######
#@   #
# $$ #
# .. #
######` },
  { name: 'Korsningen', map: `
#######
#  .  #
# $@$ #
#  .  #
#######` },
  { name: 'Hörnet', map: `
#######
#.    #
# $ # #
#   $ #
#  @ .#
#######` },
  { name: 'Tre på rad', map: `
########
#      #
# $$$  #
#  @   #
# ...  #
########` },
  { name: 'Rummet', map: `
########
#   #  #
# $    #
#   $. #
#@  #. #
########` },
  { name: 'Kryss', map: `
#######
#     #
# $.$ #
#.#@#.#
# $.$ #
#     #
#######` },
  { name: 'Lagret', map: `
 ###### 
 #    # 
## $  # 
#  $# # 
# @ . # 
#   . # 
########` },
  { name: 'Trång passage', map: `
########
#  .   #
#  ##$ #
# @ #  #
#  $   #
#  . # #
########` },
  { name: 'Hinder', map: `
 ########
 #      #
##$#$#  #
# . .  ##
#  @ # # 
####   # 
   ##### ` },
  { name: 'Fyra hörn', map: `
#######
#.   .#
# $ $ #
#  @  #
# $ $ #
#.   .#
#######` },
  { name: 'Slingan', map: `
 ####### 
 #  .  # 
## $#$ ##
#  .@.  #
## $#$ ##
 #  .  # 
 ####### ` },
  { name: 'Hyllan', map: `
########
#      #
# ##$# #
# #  . #
#  $.  #
#@ ##  #
########` },
  { name: 'Lilla knuten', map: `
#######
#     #
# #$# #
# $.$ #
#  .  #
# .@  #
#######` },
  { name: 'Sicksack', map: `
 ######
 #  . #
##$ # #
#   $ #
# #.  #
#  @ ##
##### ` },
  { name: 'Garaget', map: `
########
#@     #
# $$ # #
# .  $ #
## . # #
 # .   #
 #######` },
  { name: 'Spiralen', map: `
########
#      #
# $ #  #
# #..  #
# $ $. #
#  @   #
########` },
  { name: 'Två rum', map: `
#########
#   #   #
# $ # . #
# $   . #
#   #   #
#@$ # . #
#   #   #
#########` },
  { name: 'Lådtornet', map: `
########
#  .   #
# .$.  #
# $$$  #
#  .   #
#   @  #
########` },
  { name: 'Fabriken', map: `
#########
#   #   #
# $   $ #
#  ...  #
# $   $ #
#   #   #
#  . @  #
#########` },
  { name: 'Knuten', map: `
 #######
 #  .  #
 # $$  #
##  .$ #
#  #.  #
#  @   #
########` },
  { name: 'Korridoren', map: `
##########
#  #   . #
# $  $#  #
#  #  $. #
#@   #   #
##### .  #
    ######` },
  { name: 'Mästarbanan', map: `
 #########
 #       #
 # $ # $ #
##  #.#  #
#  .$.$  #
# #  .  ##
#   $ #. #
#  @ #   #
##########` },
  { name: 'Finalen', map: `
##########
#    #   #
# $$ # $ #
#  . .   #
## . # . #
 # $ . $ #
 #  @ #  #
 #########` },
];
